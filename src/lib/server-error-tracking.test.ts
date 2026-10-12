import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionImmediate = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (work: () => unknown) => { void work(); } }));
vi.mock("posthog-node", () => ({ PostHog: class { captureExceptionImmediate = captureExceptionImmediate; } }));

describe("server exception privacy boundary", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();
    captureExceptionImmediate.mockReset();
    vi.stubEnv("VERCEL_ENV", "");
  });

  it("uses structured SDK exception capture with redacted error text and bounded metadata", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const { captureServerException } = await import("./server-error-tracking");
    const error = new Error("account alice@example.com token=secret");
    error.stack = "Error: account alice@example.com token=secret\n at render (https://app.test/_next/static/chunks/main.js?token=secret:11:9)";
    captureServerException(error, { route: "/[route]", arbitrary: "alice@example.com", provider_code: "unexpected_failure" });
    expect(captureExceptionImmediate).toHaveBeenCalledTimes(1);
    const [safe] = captureExceptionImmediate.mock.calls[0] as [Error, string, Record<string, string>];
    expect(safe.message).toBe("account <email> token=<value>");
    expect(safe.stack).not.toMatch(/alice|secret/);
    expect(safe.stack).toContain("/_next/static/chunks/main.js:11:9");
    expect(captureExceptionImmediate.mock.calls[0][2]).toMatchObject({ route: "/[route]", provider_code: "unexpected_failure", $process_person_profile: false });
  });

  it("returns the correlation id it reports, reusing a valid one from the caller", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const { captureServerException } = await import("./server-error-tracking");
    const given = "7f1b6a2e-0000-4000-8000-000000000000";
    expect(captureServerException(new Error("Handled server failure"), { correlation_id: given, digest: "2918384837" })).toBe(given);
    expect(captureExceptionImmediate.mock.calls[0][2]).toMatchObject({ correlation_id: given, digest: "2918384837" });
    const generated = captureServerException(new Error("x"), { correlation_id: "not-a-uuid", digest: "NEXT_REDIRECT;x" });
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
    expect(captureExceptionImmediate.mock.calls[1][2]).not.toHaveProperty("digest");
  });

  it("titles unclassified errors from their scrubbed message, not a generic route label", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const { captureServerException } = await import("./server-error-tracking");
    captureServerException(new TypeError("Cannot read properties of undefined (reading 'rows')"), { route: "/dashboard", route_type: "render" });
    const [safe, , properties] = captureExceptionImmediate.mock.calls[0] as [Error, string, Record<string, unknown>];
    expect(safe.message).toBe("Cannot read properties of undefined (reading 'rows')");
    expect(properties).not.toHaveProperty("$issue_name");
    expect(properties).not.toHaveProperty("$exception_fingerprint");
  });

  it("drops obsolete free-text reasons and numeric error codes", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    const { captureServerException } = await import("./server-error-tracking");
    captureServerException(new Error("Handled server failure"), { error_source: "handled_response", route: "/api/assets/sign", error_code: "503", reason: "Private assets are temporarily unavailable" });
    expect(captureExceptionImmediate.mock.calls[0][2]).toMatchObject({ error_source: "handled_response", route: "/api/assets/sign", $process_person_profile: false });
    expect(captureExceptionImmediate.mock.calls[0][2]).not.toHaveProperty("reason");
    expect(captureExceptionImmediate.mock.calls[0][2]).not.toHaveProperty("error_code");
  });

  it("tags the Vercel environment so preview failures never read as production ones", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test_project_token");
    vi.stubEnv("VERCEL_ENV", "preview");
    const { captureServerException } = await import("./server-error-tracking");
    captureServerException(new Error("Handled server failure"), { route: "/api/assets/free", vercel_env: "production" });
    expect(captureExceptionImmediate.mock.calls[0][2]).toMatchObject({ route: "/api/assets/free", vercel_env: "preview", $process_person_profile: false });
  });

  it("uses one server identity per environment and occurrence-only correlation IDs", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("VERCEL_ENV", "production");
    const { captureServerException } = await import("./server-error-tracking");
    captureServerException(new Error("token=secret"));
    captureServerException(new Error("email=alice@example.com"));
    expect(captureExceptionImmediate.mock.calls.map((call) => call[1])).toEqual(["server:pastpaperprep:production", "server:pastpaperprep:production"]);
    const first = captureExceptionImmediate.mock.calls[0][2];
    const second = captureExceptionImmediate.mock.calls[1][2];
    expect(first).toMatchObject({ signal_kind: "server", $process_person_profile: false });
    expect(first.correlation_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(second.correlation_id).not.toBe(first.correlation_id);
    vi.stubEnv("VERCEL_ENV", "preview");
    captureServerException(new Error("x"));
    expect(captureExceptionImmediate.mock.calls[2][1]).toBe("server:pastpaperprep:preview");
  });

  it("allowlists diagnostics, gives stable actionable grouping and logs the same sanitized occurrence", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("VERCEL_ENV", "production");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureServerException } = await import("./server-error-tracking");
    const metadata = { route: "/api/assets/sign", bank: "ib-sl", stage: "signing", storage_provider: "r2", error_code: "signing_failed", reason: "Bearer secret", correlation_id: "secret", $exception_fingerprint: "secret" };
    captureServerException(new Error("alice@example.com token=secret"), metadata);
    captureServerException(new Error("different secret"), metadata);
    const first = captureExceptionImmediate.mock.calls[0][2];
    expect(first).toMatchObject({ bank: "ib-sl", stage: "signing", storage_provider: "r2", error_code: "signing_failed", $issue_name: "Server /api/assets/sign signing: signing_failed" });
    expect(first.$exception_fingerprint).toBe(captureExceptionImmediate.mock.calls[1][2].$exception_fingerprint);
    expect(log.mock.calls[0]).toEqual(["server_exception", first]);
    captureServerException(new Error("x"), { ...metadata, bank: "alice@example.com", stage: "secret", storage_provider: "secret", error_code: "secret" });
    expect(captureExceptionImmediate.mock.calls[2][2]).not.toHaveProperty("bank");
    expect(captureExceptionImmediate.mock.calls[2][2]).not.toHaveProperty("stage");
    expect(JSON.stringify(captureExceptionImmediate.mock.calls.map((call) => call[2]))).not.toMatch(/alice|secret/);
    log.mockRestore();
  });

  it("keeps different auth provider codes in separate issue groups", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    const { captureAuthProviderFailure } = await import("./server-error-tracking");
    captureAuthProviderFailure("signup_result", "smtp_error");
    captureAuthProviderFailure("signup_result", "unexpected_failure");
    expect(captureExceptionImmediate.mock.calls[0][2].$exception_fingerprint).not.toBe(captureExceptionImmediate.mock.calls[1][2].$exception_fingerprint);
  });

  it("leaves unclassified render failures to SDK stack grouping instead of collapsing every error on one route", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    const { captureServerException } = await import("./server-error-tracking");
    captureServerException(new Error("private failure"), { route: "/account", route_type: "render" });
    expect(captureExceptionImmediate.mock.calls[0][2]).not.toHaveProperty("$exception_fingerprint");
  });

  it.each(["constructor", "toString", "__proto__"])("drops prototype-named metadata key %s without disrupting rendering", async (key) => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
    const { captureServerException } = await import("./server-error-tracking");
    const metadata = Object.fromEntries([[key, "ignored"], ["route", "/account"]]);
    expect(() => captureServerException(new Error("private"), metadata)).not.toThrow();
    expect(captureExceptionImmediate).toHaveBeenCalledOnce();
    expect(Object.hasOwn(captureExceptionImmediate.mock.calls[0][2], key)).toBe(false);
  });

  it("does not send to PostHog when project configuration is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
    const { captureServerException } = await import("./server-error-tracking");
    captureServerException(new Error("private details"));
    expect(captureExceptionImmediate).not.toHaveBeenCalled();
  });
});
