"use client";

type ProductEventProperties = Record<string, string | number | boolean | null | undefined>;
type PostHogClient = typeof import("posthog-js").default;

let clientPromise: Promise<PostHogClient | null> | null = null;
let initialized = false;

function projectToken() {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ?? "";
}

function loadClient() {
  if (!projectToken()) return Promise.resolve(null);
  if (clientPromise) return clientPromise;

  clientPromise = import("posthog-js")
    .then(({ default: posthog }) => {
      if (!initialized) {
        posthog.init(projectToken(), {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
          defaults: "2026-05-30",
          autocapture: false,
          capture_pageview: true,
          capture_pageleave: true,
          person_profiles: "never",
          cookieless_mode: "always",
          disable_session_recording: true,
          // Keep remote collection configuration available for Web Vitals,
          // but do not evaluate feature flags or enable recording products.
          advanced_disable_flags: false,
          advanced_disable_feature_flags: true,
          capture_exceptions: false,
          before_send: sanitizeAnalyticsEvent,
        });
        initialized = true;
      }
      return posthog;
    })
    .catch(() => null);

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
  void loadClient();
}

export function trackProductEvent(name: string, properties: ProductEventProperties = {}) {
  void loadClient().then((posthog) => {
    if (!posthog) return;
    try {
      posthog.capture(name, Object.fromEntries(
        Object.entries(properties).filter(([, value]) => value !== undefined),
      ));
    } catch {
      // Analytics must never interrupt practice, checkout, or downloads.
    }
  });
}
