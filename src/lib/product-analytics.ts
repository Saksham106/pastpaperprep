"use client";

import { readBrowserAnalyticsConsent, stableAnalyticsDistinctId } from "@/lib/analytics-consent";

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

const ERROR_CATEGORIES = new Set(["Error", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "URIError", "EvalError", "AggregateError", "AbortError", "NetworkError", "SecurityError", "NotAllowedError", "NotFoundError"]);

export function sanitizeAnalyticsEvent<T extends { properties?: Record<string, unknown> }>(event: T | null): T | null {
  if (!event?.properties) return event;
  const scrub = (value: unknown, key = "", depth = 0): unknown => {
    if (depth > 8) return undefined;
    if (typeof value === "string" && /(?:url|href|referrer)$/i.test(key)) {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
        return `${url.origin}${url.pathname}`;
      } catch { return undefined; }
    }
    if (Array.isArray(value)) return value.map(item => scrub(item, key, depth + 1)).filter(item => item !== undefined);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, scrub(item, name, depth + 1)]).filter(([, item]) => item !== undefined));
    }
    return value;
  };
  return { ...event, properties: scrub(event.properties) as Record<string, unknown> };
}

export function captureBrowserError(error: { name?: unknown; filename?: unknown; lineno?: unknown; colno?: unknown }) {
  const category = typeof error.name === "string" && ERROR_CATEGORIES.has(error.name) ? error.name : "UnhandledError";
  let frame = "";
  if (typeof error.filename === "string") {
    try {
      const url = new URL(error.filename);
      const basename = url.pathname.split("/").filter(Boolean).pop() ?? "";
      if (/^[A-Za-z0-9_-]{1,100}\.(?:js|mjs|cjs)$/.test(basename)) {
        frame = basename;
        if (typeof error.lineno === "number" && Number.isFinite(error.lineno)) {
          frame += `:${Math.trunc(error.lineno)}`;
          if (typeof error.colno === "number" && Number.isFinite(error.colno)) frame += `:${Math.trunc(error.colno)}`;
        }
      }
    } catch { /* Ignore malformed source URLs. */ }
  }
  trackProductEvent("browser_error", { category, frame });
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
