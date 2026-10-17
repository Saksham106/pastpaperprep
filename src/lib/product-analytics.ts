"use client";

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

function projectToken() {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ?? "";
}

function loadClient() {
  if (!projectToken() || !canCapture()) return Promise.resolve(null);
  if (clientPromise) return clientPromise;

  clientPromise = import("posthog-js")
    .then(({ default: posthog }) => {
      if (!initialized) {
        posthog.init(projectToken(), {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
          defaults: "2026-05-30",
          cookieless_mode: "always",
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          person_profiles: "never",
          persistence: "memory",
          disable_cookie: true,
          disable_session_recording: true,
          // Keep remote collection configuration available for Web Vitals,
          // but do not evaluate feature flags or enable recording products.
          advanced_disable_flags: false,
          advanced_disable_feature_flags: true,
          capture_exceptions: false,
          before_send: event => {
            if (!canCapture()) return null;
            const scrubbed = sanitizeAnalyticsEvent(event);
            if (scrubbed && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("analytics_verification") === "1") {
              scrubbed.properties = { ...scrubbed.properties, analytics_verification: true };
            }
            return scrubbed;
          },
        });
        initialized = true;
      }
      return posthog;
    })
    .catch(() => { clientPromise = null; return null; });

  return clientPromise;
}

const ERROR_CATEGORIES = new Set(["Error", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "URIError", "EvalError", "AggregateError", "AbortError", "NetworkError", "SecurityError", "NotAllowedError", "NotFoundError", "UnhandledRejection"]);

export function sanitizeAnalyticsEvent<T extends { properties?: Record<string, unknown> }>(event: T | null): T | null {
  if (!event?.properties) return event;
  const scrub = (value: unknown, key = "", depth = 0, inException = false): unknown => {
    if (depth > 8) return undefined;
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
      try { const url = new URL(value); if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return undefined; return `${url.origin}${url.pathname}`; }
      catch { return undefined; }
    }
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
  const properties = {
    ...(typeof digest === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(digest) ? { digest } : {}),
    ...(userId ? { user_id: userId } : {}),
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
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com", defaults: "2026-05-30",
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
