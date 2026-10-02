import { beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));

describe("PostHog product analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    posthog.init.mockReset();
    posthog.capture.mockReset();
    posthog.identify.mockReset();
    posthog.reset.mockReset();
    posthog.opt_in_capturing.mockReset();
    posthog.opt_out_capturing.mockReset();
    document.cookie = "ppp_analytics_consent=v1.accepted; Path=/";
  });

  it("does not initialize or capture before acceptance or after rejection", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    document.cookie = "ppp_analytics_consent=; Max-Age=0; Path=/";
    const analytics = await import("@/lib/product-analytics");
    await analytics.initializeProductAnalytics();
    analytics.trackProductEvent("checkout_start");
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    document.cookie = "ppp_analytics_consent=v1.rejected; Path=/";
    await analytics.initializeProductAnalytics();
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("initializes privacy-safe client analytics only when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");

    const { initializeProductAnalytics } = await import("@/lib/product-analytics");
    initializeProductAnalytics();
    initializeProductAnalytics();

    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));
    expect(posthog.init).toHaveBeenCalledWith("phc_test_project_token", expect.objectContaining({
      api_host: "https://us.i.posthog.com",
      defaults: "2026-05-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",

      persistence: "localStorage+cookie",
      cookie_expiration: 180,
      disable_session_recording: true,
      advanced_disable_flags: false,
      advanced_disable_feature_flags: true,
      capture_exceptions: false,
    }));
    expect(posthog.init.mock.calls[0]?.[1]).not.toHaveProperty("capture_performance");
    expect(posthog.init.mock.calls[0]?.[1]).not.toHaveProperty("cookieless_mode");
    expect(posthog.init.mock.calls[0]?.[1]).not.toHaveProperty("session_recording");
  });

  it("identifies consenting accounts and resets before switching or logging out", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const analytics = await import("@/lib/product-analytics");
    await analytics.initializeProductAnalytics();
    await analytics.setProductAnalyticsIdentity("user-a", true);
    expect(posthog.identify).toHaveBeenLastCalledWith("account:user-a", { is_operator: true });
    await analytics.setProductAnalyticsIdentity("user-b");
    expect(posthog.reset).toHaveBeenCalledTimes(1);
    expect(posthog.identify).toHaveBeenLastCalledWith("account:user-b", { is_operator: false });
    await analytics.setProductAnalyticsIdentity(null);
    expect(posthog.reset).toHaveBeenCalledTimes(2);
  });

  it("revokes and clears only this project's identifiers", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const analytics = await import("@/lib/product-analytics");
    await analytics.initializeProductAnalytics();
    await analytics.setProductAnalyticsIdentity("user-a");
    window.localStorage.setItem("ph_phc_test_project_token_posthog", "identifier");
    window.localStorage.setItem("unrelated", "keep");
    analytics.disableProductAnalytics();
    analytics.trackProductEvent("checkout_start");
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.reset).toHaveBeenCalledWith(true);
    expect(window.localStorage.getItem("ph_phc_test_project_token_posthog")).toBeNull();
    expect(window.localStorage.getItem("unrelated")).toBe("keep");
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("does not capture an event queued before rejection", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const analytics = await import("@/lib/product-analytics");
    await analytics.initializeProductAnalytics();
    analytics.trackProductEvent("checkout_start");
    analytics.disableProductAnalytics();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("tags verification traffic while still removing sensitive URL data", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const original = window.location.href;
    window.history.replaceState(null, "", "/privacy?analytics_verification=1");
    try {
      const analytics = await import("@/lib/product-analytics");
      await analytics.initializeProductAnalytics();
      const beforeSend = posthog.init.mock.calls[0][1].before_send;
      const result = beforeSend({ properties: { $current_url: "https://pastpaperprep.com/privacy?token=private" } });
      expect(result.properties).toEqual({ $current_url: "https://pastpaperprep.com/privacy", analytics_verification: true });
    } finally { window.history.replaceState(null, "", original); }
  });

  it("does nothing when PostHog is not configured", async () => {
    const { initializeProductAnalytics, trackProductEvent } = await import("@/lib/product-analytics");

    initializeProductAnalytics();
    trackProductEvent("checkout_start", { productId: "bundle_all" });

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("captures explicit funnel events without undefined properties", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const { initializeProductAnalytics, trackProductEvent } = await import("@/lib/product-analytics");
    initializeProductAnalytics();

    trackProductEvent("checkout_start", {
      productId: "bundle_all",
      interval: "annual",
      bankCount: 6,
      bank: undefined,
    });

    await vi.waitFor(() => {
      expect(posthog.capture).toHaveBeenCalledWith("checkout_start", {
        productId: "bundle_all",
        interval: "annual",
        bankCount: 6,
      });
    });
  });

  it("scrubs browser error telemetry to a bounded category and URL-free stack frames", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const { initializeProductAnalytics, captureBrowserError } = await import("@/lib/product-analytics");
    initializeProductAnalytics();
    captureBrowserError({
      name: "TypeError",
      filename: "https://example.test/_next/static/chunks/app.js?token=secret#hash",
      lineno: 12,
      colno: 34,
    });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith("browser_error", {
      category: "TypeError",
      frame: "app.js:12:34",
    }));
    expect(JSON.stringify(posthog.capture.mock.calls)).not.toContain("secret");
  });

  it("removes query strings and auth fragments before events leave the browser", async () => {
    const { sanitizeAnalyticsEvent } = await import("@/lib/product-analytics");
    const result = sanitizeAnalyticsEvent({ event: "$pageview", properties: {
      $current_url: "https://pastpaperprep.com/auth/email-link?token_hash=private#access_token=private",
      $referrer: "https://pastpaperprep.com/login?email=person@example.com",
      bankCount: 3,
    } });
    expect(result?.properties).toEqual({
      $current_url: "https://pastpaperprep.com/auth/email-link",
      $referrer: "https://pastpaperprep.com/login",
      bankCount: 3,
    });
  });

  it("drops invalid analytics URLs and arbitrary error names", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const { sanitizeAnalyticsEvent, captureBrowserError, initializeProductAnalytics } = await import("@/lib/product-analytics");
    await initializeProductAnalytics();
    expect(sanitizeAnalyticsEvent({ properties: { $current_url: "javascript:private", count: 2 } })?.properties).toEqual({ count: 2 });
    captureBrowserError({ name: "PrivateCustomerNameError", filename: "https://example.test/alice.email.js?token=private" });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith("browser_error", { category: "UnhandledError", frame: "" }));
  });

  it("scrubs nested Web Vitals navigation and resource URLs", async () => {
    const { sanitizeAnalyticsEvent } = await import("@/lib/product-analytics");
    const result = sanitizeAnalyticsEvent({ properties: { $web_vitals_LCP_event: {
      value: 1200, navigationURL: "https://pastpaperprep.com/account?token=private#secret",
      attribution: { url: "https://assets.example.test/crop.webp?signature=private", resourceLoadDuration: 250 },
    } } });
    expect(result?.properties.$web_vitals_LCP_event).toEqual({ value: 1200, navigationURL: "https://pastpaperprep.com/account",
      attribution: { url: "https://assets.example.test/crop.webp", resourceLoadDuration: 250 } });
  });

  it("does not identify an account from initialization alone", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const { initializeProductAnalytics } = await import("@/lib/product-analytics");
    initializeProductAnalytics();

    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.reset).not.toHaveBeenCalled();
  });

  it("never lets analytics failures interrupt the product", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    posthog.capture.mockImplementation(() => { throw new Error("analytics unavailable"); });
    const { initializeProductAnalytics, trackProductEvent } = await import("@/lib/product-analytics");
    initializeProductAnalytics();

    expect(() => trackProductEvent("checkout_start")).not.toThrow();
  });
});
