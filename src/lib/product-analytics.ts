"use client";

import { analyticsEventContext, browserErrorContext, reactMismatchKind } from "@/lib/browser-error-context";
import { readBrowserAnalyticsConsent, stableAnalyticsDistinctId } from "@/lib/analytics-consent";
import { boundExceptionFrames, safeErrorMessage, scrubStack } from "@/lib/error-privacy";
import { accountIdFromCookieHeader } from "@/lib/supabase/auth-cookie";
import { isExpectedRequestError as isExpectedControlFlow } from "@/lib/expected-request-error";
export { isExpectedRequestError as isExpectedControlFlow } from "@/lib/expected-request-error";

/** Signed-in account id for error and failure reports only (disclosed in /privacy); undefined when signed out. */
export function browserAccountId(): string | undefined {
  try { return typeof document === "undefined" ? undefined : accountIdFromCookieHeader(document.cookie); } catch { return undefined; }
}

type ProductEventProperties = Record<string, string | number | boolean | null | undefined>;
type PostHogClient = typeof import("posthog-js").default;

let clientPromise: Promise<PostHogClient | null> | null = null;
let consentClientPromise: Promise<PostHogClient | null> | null = null;
let initialized = false;
let consentInitialized = false;
let consentClient: PostHogClient | null = null;
let generation = 0;
let accountIdentity: string | null = null;
let consentEnabled = false;

function canCapture() { return true; }
function canCaptureConsented() { return consentEnabled && readBrowserAnalyticsConsent() === true; }

/**
 * Browser events go to our own domain; vercel.json forwards /pp-relay/* to PostHog at the edge
 * with the cookie header removed (no function runs, and the visitor's IP still reaches PostHog
 * through x-forwarded-for). The name is deliberately plain: filter lists such as EasyPrivacy
 * block the usual proxy paths (/ingest/i/v0/*), PostHog's batch path (/i/v0/e/ on any host) and
 * its add-on script names. Server-side code keeps talking to PostHog directly.
 */
export const BROWSER_POSTHOG_API_HOST = "/pp-relay";
/** The classic capture endpoint; PostHog's remote config would switch the SDK to /i/v0/e/. */
export const BROWSER_CAPTURE_ENDPOINT = "/e/";
export const POSTHOG_UI_HOST = "https://us.posthog.com";

function projectToken() {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ?? "";
}

function loadClient() {
  if (!projectToken() || !canCapture()) return Promise.resolve(null);
  if (clientPromise) return clientPromise;

  // The country table is optional enrichment: if its chunk fails to load, analytics still runs without it.
  const countryLookup = import("@/lib/timezone-country").then(({ countryFromTimeZone }) => countryFromTimeZone, () => () => null);
  // Bundled add-ons: otherwise the SDK fetches these scripts by names that filter lists block.
  // Each registers itself on window.__PosthogExtensions__, so the SDK skips the download.
  const addOns = Promise.all([
    import("posthog-js/dist/web-vitals-with-attribution"),
    import("posthog-js/dist/dead-clicks-autocapture"),
  ]).catch(() => undefined);
  clientPromise = Promise.all([import("posthog-js"), countryLookup, addOns])
    .then(([{ default: posthog }, countryFromTimeZone]) => {
      if (!initialized) {
        posthog.init(projectToken(), {
          api_host: BROWSER_POSTHOG_API_HOST,
          ui_host: POSTHOG_UI_HOST,
          defaults: "2026-05-30",
          cookieless_mode: "always",
          autocapture: false,
          capture_pageview: false,
          // Leaving a page reports time on page and how far it was scrolled ($prev_pageview_*), which
          // also gives PostHog's web analytics a real bounce rate and its heatmaps a scroll map.
          capture_pageleave: true,
          // Click positions per page (not billed), plus clicks that changed nothing on the page
          // ($dead_click). Element text and attribute values are masked for both, and only public
          // study pages send either (BEHAVIOUR_CAPTURE_PATH); mouse movement and swipes are not sent.
          capture_heatmaps: true,
          capture_dead_clicks: { capture_dead_swipes: false },
          mask_all_text: true,
          mask_all_element_attributes: true,
          person_profiles: "never",
          persistence: "memory",
          disable_cookie: true,
          disable_session_recording: true,
          // Keep remote collection configuration available for Web Vitals,
          // but do not evaluate feature flags or enable recording products.
          advanced_disable_flags: false,
          advanced_disable_feature_flags: true,
          capture_exceptions: false,
          // Name the element behind each layout shift (largestShiftTarget is a CSS selector);
          // the SDK default attributes only INP and LCP. Web Vitals stay on the project setting.
          capture_performance: { web_vitals_attribution: ["CLS", "INP", "LCP"] },
          before_send: event => {
            if (!canCapture()) return null;
            const scrubbed = withEventContext(sanitizeAnalyticsEvent(event));
            if (scrubbed && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("analytics_verification") === "1") {
              scrubbed.properties = { ...scrubbed.properties, analytics_verification: true };
            }
            return withTimeZoneCountry(scrubbed, countryFromTimeZone);
          },
        });
        pinCaptureEndpoint(posthog);
        initialized = true;
      }
      return posthog;
    })
    .catch(() => { clientPromise = null; return null; });

  return clientPromise;
}

/**
 * Keep the SDK on PostHog's classic /e/ capture endpoint. Its remote config otherwise moves
 * batches to /i/v0/e/, which EasyPrivacy blocks on every host (so the relay alone wouldn't help).
 * /e/ accepts the same events. Pinned by posthog-sdk.compat.test.ts against the installed SDK.
 */
export function pinCaptureEndpoint(client: object | null | undefined) {
  if (!client) return;
  try {
    Object.defineProperty(client, "analyticsDefaultEndpoint", { configurable: true, enumerable: true, get: () => BROWSER_CAPTURE_ENDPOINT, set: () => {} });
  } catch { /* Analytics must never break the page. */ }
}

/**
 * Every anonymous event says whether the visitor is signed in (a boolean, never the account), their
 * network class and the release, so speed and behaviour can be split by those. Heatmap batches skip it.
 */
function withEventContext<T extends { event?: string; properties?: Record<string, unknown> }>(event: T | null): T | null {
  if (!event?.properties || event.event === "$$heatmap" || typeof window === "undefined") return event;
  let context = {};
  try { context = analyticsEventContext(window); } catch { /* Context is optional enrichment. */ }
  return { ...event, properties: { ...event.properties, ...context, signed_in: browserAccountId() !== undefined } };
}

/**
 * Heatmap and dead-click data only leaves the page on public study pages. Sign-in, account,
 * dashboard, worksheets, invite/referral and anything else never send click positions.
 */
const BEHAVIOUR_CAPTURE_PATH = /^\/(?:$|banks(?:\/|$)|past-papers(?:\/|$)|revision-notes(?:\/|$)|articles(?:\/|$)|pricing\/?$|cambridge-igcse(?:\/|$)|cambridge-a-level(?:\/|$)|ib(?:\/|$)|syllabus(?:\/|$)|grade-thresholds(?:\/|$)|teachers(?:\/|$)|updates(?:\/|$)|faq\/?$)/;
export function isBehaviourCapturePath(pathname: string): boolean {
  return BEHAVIOUR_CAPTURE_PATH.test(pathname);
}
// Heatmap point types worth sending; mouse-movement traces are dropped.
const HEATMAP_POINT_TYPES = new Set(["click", "rageclick", "deadclick"]);

function pageviewPath(url: unknown): string | null {
  try { return typeof url === "string" ? new URL(url).pathname : null; } catch { return null; }
}

// Invite and referral links carry a code in the path; analytics only needs the route.
const CODE_PATH = /^\/(invite|r)\/[^/]+/;
function scrubPath(pathname: string): string {
  return pathname.replace(CODE_PATH, "/$1/:code");
}

/** Heatmap batches are keyed by the page's full URL; keep only origin and path, merging pages that differ only by query. */
function scrubHeatmapData(data: unknown): Record<string, unknown[]> | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const pages: Record<string, unknown[]> = {};
  for (const [href, points] of Object.entries(data)) {
    if (!Array.isArray(points)) continue;
    let page: string;
    try {
      const url = new URL(href);
      if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) continue;
      if (!isBehaviourCapturePath(url.pathname)) continue;
      page = `${url.origin}${scrubPath(url.pathname)}`;
    } catch { continue; }
    const merged = [...(pages[page] ?? []), ...points.filter(point => point && typeof point === "object" && HEATMAP_POINT_TYPES.has(String((point as { type?: unknown }).type)))];
    if (!merged.length) continue;
    pages[page] = merged.slice(0, 1000);
  }
  return Object.keys(pages).length ? pages : undefined;
}

/**
 * Cookieless ingestion discards the IP, so PostHog's GeoIP leaves anonymous events without a country and the
 * web-analytics map stays empty. Fill the country from the browser's time zone instead (no IP, no cookie).
 * Never overrides a real GeoIP value.
 */
export function withTimeZoneCountry<T extends { properties?: Record<string, unknown> }>(event: T | null, lookup: (timeZone: unknown) => { code: string; name: string } | null): T | null {
  if (!event?.properties || event.properties.$geoip_country_code) return event;
  const country = lookup(event.properties.$timezone);
  if (!country) return event;
  return { ...event, properties: { ...event.properties, $geoip_country_code: country.code, $geoip_country_name: country.name, country_source: "timezone" } };
}

const ERROR_CATEGORIES = new Set(["Error", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "URIError", "EvalError", "AggregateError", "AbortError", "NetworkError", "SecurityError", "NotAllowedError", "NotFoundError", "UnhandledRejection", "ChunkLoadError"]);

export function sanitizeAnalyticsEvent<T extends { event?: string; properties?: Record<string, unknown> }>(event: T | null): T | null {
  if (!event?.properties) return event;
  if (event.event === "$dead_click" || event.event === "$dead_swipe") {
    const pathname = typeof event.properties.$pathname === "string" ? event.properties.$pathname : pageviewPath(event.properties.$current_url);
    if (event.event === "$dead_swipe" || !pathname || !isBehaviourCapturePath(pathname)) return null;
  }
  if (event.event === "$$heatmap" && !scrubHeatmapData(event.properties.$heatmap_data)) return null;
  const scrub = (value: unknown, key = "", depth = 0, inException = false): unknown => {
    if (depth > 8) return undefined;
    if (depth === 1 && key === "$heatmap_data") return scrubHeatmapData(value);
    // Masked in the SDK too (mask_all_text); never let an element's text through.
    if (key === "$el_text") return undefined;
    const exception = inException || /exception/i.test(key);
    // An exception's own `value` survives as its scrubbed message; every other message field is dropped.
    if (exception && key === "value" && depth > 1) return safeErrorMessage(value);
    if (exception && (/^(?:value|message|error|error_string)$/i.test(key) || /exception.*(?:message|value|error)/i.test(key))) return undefined;
    if (exception && /^(?:filename|source|url|href)$/i.test(key)) {
      if (typeof value !== "string" || value.length > 2048) return undefined;
      try { const url = new URL(value); const path = boundExceptionFrames([{ filename: value }])[0]?.filename; return path ? `${url.origin}${new URL(path).pathname}` : undefined; }
      catch { return undefined; }
    }
    if (typeof value === "string" && /(?:url|href|referrer)$/i.test(key)) {
      try { const url = new URL(value); if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return undefined; return `${url.origin}${scrubPath(url.pathname)}`; }
      catch { return undefined; }
    }
    if (typeof value === "string" && (/pathname$/i.test(key) || key === "path")) return scrubPath(value);
    if (Array.isArray(value)) {
      const items = exception && key === "frames" ? boundExceptionFrames(value.filter(item => item && typeof item === "object") as Record<string, unknown>[]) : value;
      return items.slice(0, exception ? 50 : items.length).map(item => scrub(item, key, depth + 1, exception)).filter(item => item !== undefined);
    }
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, scrub(item, name, depth + 1, exception)]).filter(([, item]) => item !== undefined));
    if (typeof value === "string" && exception) return value.slice(0, 500);
    return value;
  };
  return { ...event, properties: scrub(event.properties) as Record<string, unknown> };
}

/** Never lets a context read stop the report itself. */
function pageContext() {
  if (typeof document === "undefined" || typeof window === "undefined") return {};
  try { return browserErrorContext(document, window); } catch { return {}; }
}

const reportedErrors = new WeakSet<object>();
// A timer or loop can throw a fresh error object every few seconds; report each kind a few times per page load.
// The key includes the scrubbed top frames, so a noisy source can't use up another code location's budget. It never leaves the page.
const MAX_REPORTS_PER_KIND = 3;
const reportsPerKind = new Map<string, number>();
export function captureAppException(error: unknown) {
  if (isExpectedControlFlow(error) || (error && typeof error === "object" && reportedErrors.has(error))) return;
  if (error && typeof error === "object") reportedErrors.add(error);
  if (!(error instanceof Error)) return;
  const safe = new Error(safeErrorMessage(error.message) ?? "Application exception");
  safe.name = ERROR_CATEGORIES.has(error.name) ? error.name : "Error";
  safe.stack = scrubStack(error.stack, safe.name);
  const kind = [safe.name, safe.message, ...(safe.stack?.split("\n").slice(1, 4) ?? [])].join("\n");
  const reports = reportsPerKind.get(kind) ?? 0;
  if (reports >= MAX_REPORTS_PER_KIND) return;
  reportsPerKind.set(kind, reports + 1);
  // A server render failure reaches the error boundary with the same digest the server reported.
  const digest = (error as { digest?: unknown }).digest;
  const userId = browserAccountId();
  const mismatch = reactMismatchKind(error.message);
  const properties = {
    ...(typeof digest === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(digest) ? { digest } : {}),
    ...(userId ? { user_id: userId } : {}),
    ...(mismatch ? { react_mismatch: mismatch } : {}),
    ...pageContext(),
  };
  void loadClient().then(client => {
    if (!client) return;
    try { client.captureException(safe, Object.keys(properties).length ? properties : undefined); } catch { /* Never affect application behavior. */ }
  });
}

function clearLegacyAnalyticsStorage() {
  if (typeof window === "undefined" || !projectToken()) return;
  const key = `ph_${projectToken()}_posthog`;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try { window[name].removeItem(key); } catch { /* Preserve unrelated storage. */ }
  }
  try {
    document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.cookie = `${key}=; Max-Age=0; Path=/; Domain=${window.location.hostname}; SameSite=Lax`;
  } catch { /* Browser privacy controls may restrict storage. */ }
}

export function initializeProductAnalytics() {
  clearLegacyAnalyticsStorage();
  return loadClient();
}

export function initializeConsentedAnalytics() {
  consentEnabled = readBrowserAnalyticsConsent() === true;
  const epoch = generation;
  return loadConsentedClient().then(client => {
    if (client && epoch === generation && canCaptureConsented()) {
      client.opt_in_capturing({ captureEventName: false });
    }
    return client;
  });
}

function loadConsentedClient() {
  if (!projectToken() || !canCaptureConsented()) return Promise.resolve(null);
  if (consentClientPromise) return consentClientPromise;
  const startedAt = generation;
  consentClientPromise = import("posthog-js").then(({ default: posthog }) => {
    if (!canCaptureConsented() || startedAt !== generation) { consentClientPromise = null; return null; }
    if (!consentInitialized) {
      consentClient = posthog.init(projectToken(), {
        api_host: BROWSER_POSTHOG_API_HOST, ui_host: POSTHOG_UI_HOST, defaults: "2026-05-30",
        autocapture: false, capture_pageview: false, capture_pageleave: false, person_profiles: "identified_only",
        persistence: "localStorage+cookie", persistence_name: `${projectToken()}_consented`, cookie_expiration: 180, cross_subdomain_cookie: false,
        consent_persistence_name: `__ph_opt_in_out_${projectToken()}_consented`,
        opt_out_capturing_cookie_prefix: "__ph_opt_in_out_consented_",
        disable_session_recording: true, advanced_disable_flags: true, advanced_disable_feature_flags: true,
        capture_performance: false,
        capture_exceptions: false, before_send: event => {
          if (!canCaptureConsented()) return null;
          const scrubbed = sanitizeAnalyticsEvent(event);
          if (scrubbed && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("analytics_verification") === "1") {
            scrubbed.properties = { ...scrubbed.properties, analytics_verification: true };
          }
          return scrubbed;
        },
      }, "consented");
      pinCaptureEndpoint(consentClient);
      consentInitialized = true;
    }
    return consentClient;
  }).catch(() => { consentClientPromise = null; return null; });
  return consentClientPromise;
}

export async function setProductAnalyticsIdentity(userId: string | null, isOperator = false, email?: string | null) {
  const next = stableAnalyticsDistinctId(userId);
  if (next === accountIdentity) {
    if (next && canCaptureConsented() && email) {
      const epoch = generation;
      const client = await loadConsentedClient();
      if (!client || epoch !== generation || !canCaptureConsented() || next !== accountIdentity) return;
      try { client.identify(next, { is_operator: isOperator, ...(email ? { email } : {}) }); } catch { /* Best effort; never block auth. */ }
    }
    return;
  }
  const epoch = ++generation;
  if (consentClient && accountIdentity !== null) {
    try { consentClient.reset(true); } catch { /* Best effort. */ }
  }
  accountIdentity = next;
  if (!next || !canCaptureConsented()) return;
  const client = await loadConsentedClient();
  if (!client || epoch !== generation || !canCaptureConsented()) return;
  try { client.identify(next, { is_operator: isOperator, ...(email ? { email } : {}) }); } catch { /* Never block auth. */ }
}

export function disableProductAnalytics() {
  consentEnabled = false;
  generation++;
  accountIdentity = null;
  try { consentClient?.opt_out_capturing(); } catch { /* Continue local cleanup. */ }
  try { consentClient?.reset(true); } catch { /* Clear only optional-channel identity. */ }
  if (typeof window === "undefined" || !projectToken()) return;
  const prefix = `ph_${projectToken()}_consented`;
  const optOutKeys = [`__ph_opt_in_out_${projectToken()}_consented`, `__ph_opt_in_out_consented_${projectToken()}`];
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[name];
      for (const key of Object.keys(storage)) if (key.startsWith(prefix) || optOutKeys.includes(key)) storage.removeItem(key);
    } catch { /* Still attempt cookie cleanup if one storage API is blocked. */ }
  }
  try {
    for (const part of document.cookie.split(";")) {
      const key = part.split("=")[0].trim();
      if (!key.startsWith(prefix) && !optOutKeys.includes(key)) continue;
      document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax`;
      document.cookie = `${key}=; Max-Age=0; Path=/; Domain=${window.location.hostname}; SameSite=Lax`;
    }
  } catch { /* Storage may be unavailable by browser policy. */ }
}

export function trackConsentedProductEvent(name: string, properties: ProductEventProperties = {}) {
  const epoch = generation;
  void loadConsentedClient().then(client => {
    if (!client || !canCaptureConsented() || epoch !== generation) return;
    try { client.capture(`consented_${name}`, Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined))); } catch { /* Best effort. */ }
  });
}

export function trackProductEvent(name: string, properties: ProductEventProperties = {}) {
  if (name !== "$pageview") trackConsentedProductEvent(name, properties);
  void loadClient().then((posthog) => {
    if (!posthog || !canCapture()) return;
    try {
      posthog.capture(name, Object.fromEntries(
        Object.entries(properties).filter(([, value]) => value !== undefined),
      ));
    } catch {
      // Analytics must never interrupt practice, checkout, or downloads.
    }
  });
}
