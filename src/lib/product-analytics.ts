"use client";

import { readBrowserAnalyticsConsent, stableAnalyticsDistinctId } from "@/lib/analytics-consent";

type ProductEventProperties = Record<string, string | number | boolean | null | undefined>;
type PostHogClient = typeof import("posthog-js").default;

let clientPromise: Promise<PostHogClient | null> | null = null;
let initialized = false;
let loadedClient: PostHogClient | null = null;
let suspended = true;
let generation = 0;
let accountIdentity: string | null = null;

function canCapture() {
  return !suspended && readBrowserAnalyticsConsent() === true;
}

function projectToken() {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ?? "";
}

function loadClient() {
  if (!projectToken() || !canCapture()) return Promise.resolve(null);
  if (clientPromise) return clientPromise;

  const startedAt = generation;
  clientPromise = import("posthog-js")
    .then(({ default: posthog }) => {
      if (!canCapture() || startedAt !== generation) { clientPromise = null; return null; }
      if (!initialized) {
        posthog.init(projectToken(), {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
          defaults: "2026-05-30",
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: true,
          person_profiles: "identified_only",

          persistence: "localStorage+cookie",
          cookie_expiration: 180,
          cross_subdomain_cookie: false,
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
        posthog.opt_in_capturing({ captureEventName: false });
      }
      loadedClient = posthog;
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

export function initializeProductAnalytics() {
  suspended = false;
  return loadClient().then(posthog => {
    if (posthog && canCapture()) posthog.opt_in_capturing({ captureEventName: false });
  });
}

export async function setProductAnalyticsIdentity(userId: string | null, isOperator = false) {
  const next = stableAnalyticsDistinctId(userId);
  if (next === accountIdentity) return;
  const epoch = ++generation;
  if (loadedClient && accountIdentity !== null) {
    try { loadedClient.reset(true); } catch { /* Best effort. */ }
  }
  accountIdentity = next;
  if (!next || !canCapture()) return;
  let client = await loadClient();
  if (!client && epoch === generation && canCapture()) client = await loadClient();
  if (!client || epoch !== generation || !canCapture()) return;
  try { client.identify(next, { is_operator: isOperator }); } catch { /* Never block auth. */ }
}

export function disableProductAnalytics() {
  suspended = true;
  generation++;
  accountIdentity = null;
  try { loadedClient?.opt_out_capturing(); } catch { /* Continue local cleanup. */ }
  try { loadedClient?.reset(true); } catch { /* Clear cached account identity as well as storage. */ }
  if (typeof window === "undefined" || !projectToken()) return;
  const prefix = `ph_${projectToken()}_`;
  const optOut = `__ph_opt_in_out_${projectToken()}`;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[name];
      for (const key of Object.keys(storage)) if (key.startsWith(prefix) || key === optOut) storage.removeItem(key);
    } catch { /* Still attempt cookie cleanup if one storage API is blocked. */ }
  }
  try {
    for (const part of document.cookie.split(";")) {
      const key = part.split("=")[0].trim();
      if (!key.startsWith(prefix) && key !== optOut) continue;
      document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax`;
      document.cookie = `${key}=; Max-Age=0; Path=/; Domain=${window.location.hostname}; SameSite=Lax`;
    }
  } catch { /* Storage may be unavailable by browser policy. */ }
}

export function trackProductEvent(name: string, properties: ProductEventProperties = {}) {
  const epoch = generation;
  void loadClient().then((posthog) => {
    if (!posthog || !canCapture() || epoch !== generation) return;
    try {
      posthog.capture(name, Object.fromEntries(
        Object.entries(properties).filter(([, value]) => value !== undefined),
      ));
    } catch {
      // Analytics must never interrupt practice, checkout, or downloads.
    }
  });
}
