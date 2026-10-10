import { beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionImmediate = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (work: () => unknown) => { void work(); } }));
vi.mock("posthog-node", () => ({ PostHog: class { captureExceptionImmediate = captureExceptionImmediate; } }));

describe("server exception privacy boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    captureExceptionImmediate.mockReset();
  });

  it("uses structured SDK exception capture with redacted error text and bounded metadata", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const { captureServerException } = await import("./server-error-tracking");
    const error = new Error("account alice@example.com token=secret");
    error.stack = "Error: account alice@example.com token=secret\n at render (https://app.test/_next/static/chunks/main.js?token=secret:11:9)";
    captureServerException(error, { route: "/[route]", arbitrary: "alice@example.com", provider_code: "unexpected_failure" });
    expect(captureExceptionImmediate).toHaveBeenCalledTimes(1);
    const [safe] = captureExceptionImmediate.mock.calls[0] as [Error, string, Record<string, string>];
    expect(safe.message).toBe("Application server exception");
    expect(safe.stack).not.toMatch(/alice|secret/);
    expect(safe.stack).toContain("/_next/static/chunks/main.js:11:9");
    expect(captureExceptionImmediate.mock.calls[0][2]).toEqual({ route: "/[route]", provider_code: "unexpected_failure", $process_person_profile: false });
  });

  it("keeps the handled-response reason and status alongside the route", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const { captureServerException } = await import("./server-error-tracking");
    captureServerException(new Error("Handled server failure"), { error_source: "handled_response", route: "/api/assets/sign", error_code: "503", reason: "Private assets are temporarily unavailable" });
    expect(captureExceptionImmediate.mock.calls[0][2]).toEqual({ error_source: "handled_response", route: "/api/assets/sign", error_code: "503", reason: "Private assets are temporarily unavailable", $process_person_profile: false });
  });

  it("is a no-op when PostHog project configuration is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    const { captureServerException } = await import("./server-error-tracking");
    captureServerException(new Error("private details"));
    expect(captureExceptionImmediate).not.toHaveBeenCalled();
  });
});
