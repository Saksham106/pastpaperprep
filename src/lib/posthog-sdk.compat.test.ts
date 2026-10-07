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
});
