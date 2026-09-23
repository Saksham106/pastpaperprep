import { beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
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
      capture_pageview: true,
      capture_pageleave: true,
      person_profiles: "never",
      cookieless_mode: "always",
      disable_session_recording: true,
      advanced_disable_flags: true,
    }));
    expect(posthog.init.mock.calls[0]?.[1]).not.toHaveProperty("session_recording");
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

  it("never identifies users in always-cookieless mode", async () => {
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
