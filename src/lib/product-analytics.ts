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
          advanced_disable_flags: true,
          capture_performance: false,
          capture_exceptions: false,
        });
        initialized = true;
      }
      return posthog;
    })
    .catch(() => null);

  return clientPromise;
}

export function captureBrowserError(error: { name?: unknown; filename?: unknown; lineno?: unknown; colno?: unknown }) {
  const category = typeof error.name === "string" && /^[A-Za-z]{1,40}Error$/.test(error.name) ? error.name : "UnhandledError";
  let frame = "";
  if (typeof error.filename === "string") {
    try {
      const url = new URL(error.filename);
      const basename = url.pathname.split("/").filter(Boolean).pop() ?? "";
      if (basename.endsWith(".js") || basename.endsWith(".mjs") || basename.endsWith(".cjs")) {
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
