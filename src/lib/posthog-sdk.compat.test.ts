import { readFileSync } from "node:fs";
import { join } from "node:path";
import posthog from "posthog-js";
import { describe, expect, it } from "vitest";

describe("installed PostHog exception API", () => {
  it("captures structured SDK exceptions in always-cookieless mode without automatic capture", () => {
    const exceptionEvents: Array<{ event?: string; properties?: Record<string, unknown> }> = [];
    const client = posthog.init("phc_sdk_compatibility_test", {
      api_host: "https://us.i.posthog.com",
      defaults: "2026-05-30",
      cookieless_mode: "always",
      person_profiles: "never",
      persistence: "memory",
      disable_cookie: true,
      disable_session_recording: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      advanced_disable_flags: true,
      advanced_disable_feature_flags: true,
      before_send(event) {
        exceptionEvents.push(event as { event?: string; properties?: Record<string, unknown> });
        return null;
      },
    }, "exception-compat-test");

    expect(typeof client.captureException).toBe("function");
    client.captureException(new TypeError("safe diagnostic"));
    expect(exceptionEvents[0]?.event).toBe("$exception");
    expect(exceptionEvents[0]?.properties?.$exception_list).toBeDefined();
  });

  it("adds CLS attribution without switching Web Vitals on locally", () => {
    const client = posthog.init("phc_sdk_compatibility_test", {
      api_host: "https://us.i.posthog.com",
      defaults: "2026-05-30",
      cookieless_mode: "always",
      persistence: "memory",
      disable_cookie: true,
      disable_session_recording: true,
      advanced_disable_flags: true,
      capture_performance: { web_vitals_attribution: ["CLS", "INP", "LCP"] },
    }, "web-vitals-compat-test");
    const webVitals = (client as unknown as { webVitalsAutocapture?: { attributionMetrics: string[]; isEnabled: boolean } }).webVitalsAutocapture;
    expect(webVitals?.attributionMetrics).toEqual(["CLS", "INP", "LCP"]);
    // No remote config has arrived, so the project setting has not enabled it yet.
    expect(webVitals?.isEnabled).toBe(false);
  });
});

describe("installed PostHog capture endpoint", () => {
  it("keeps batches on /e/ under the relay even when remote config asks for /i/v0/e/", async () => {
    const { BROWSER_POSTHOG_API_HOST, pinCaptureEndpoint } = await import("@/lib/product-analytics");
    const client = posthog.init("phc_sdk_endpoint_test", {
      api_host: BROWSER_POSTHOG_API_HOST, defaults: "2026-05-30", cookieless_mode: "always", persistence: "memory",
      disable_cookie: true, disable_session_recording: true, autocapture: false, capture_pageview: false,
      advanced_disable_flags: true, advanced_disable_feature_flags: true,
    }, "endpoint-compat-test") as unknown as { analyticsDefaultEndpoint: string; requestRouter: { endpointFor: (target: string, path: string) => string } };
    pinCaptureEndpoint(client);
    // What the SDK's remote-config handler does with `analytics.endpoint`.
    client.analyticsDefaultEndpoint = "/i/v0/e/";
    expect(client.analyticsDefaultEndpoint).toBe("/e/");
    expect(client.requestRouter.endpointFor("api", client.analyticsDefaultEndpoint)).toMatch(/\/pp-relay\/e\/$/);
  });

  it("still applies the remote endpoint through the public analyticsDefaultEndpoint property", () => {
    const bundle = readFileSync(join(process.cwd(), "node_modules/posthog-js/dist/module.mjs"), "utf8");
    expect(bundle).toMatch(/this\.analyticsDefaultEndpoint=[A-Za-z_$][\w$]*\.analytics\.endpoint/);
  });
});

