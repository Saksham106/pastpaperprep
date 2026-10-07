import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createAuthAttemptId, validAuthAttemptId, logAuthDiagnostic } from "./auth-diagnostics";

const attemptId = "30be40c9-7a0a-4250-8615-7b929938a620";

afterEach(() => vi.restoreAllMocks());

describe("token-free auth diagnostics", () => {
  it("creates opaque UUIDs and rejects arbitrary client correlation strings", () => {
    expect(validAuthAttemptId(createAuthAttemptId())).toBe(true);
    expect(validAuthAttemptId(attemptId)).toBe(true);
    for (const value of [null, "student@example.com", "a".repeat(64), "bad\nlog", { id: attemptId }]) {
      expect(validAuthAttemptId(value)).toBe(false);
    }
  });

  it("logs only allowlisted metadata, never extra credentials or raw provider messages", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const input = {
      attemptId, phase: "confirmation_result" as const, outcome: "rejected" as const,
      providerCode: "otp_expired", email: "private@example.com", token_hash: "private-token",
      password: "private-password", message: "Sensitive raw provider message",
    };
    logAuthDiagnostic(input);
    expect(info).toHaveBeenCalledWith({ event: "auth_flow", attemptId, phase: "confirmation_result", outcome: "rejected", providerCode: "otp_expired" });
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/private|Sensitive/);
  });

  it("replaces unsafe provider codes and ignores invalid attempt identifiers", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logAuthDiagnostic({ attemptId, phase: "signup_result", outcome: "rejected", providerCode: "email=private@example.com" });
    expect(info.mock.calls[0][0]).toMatchObject({ providerCode: "unknown" });
    logAuthDiagnostic({ attemptId: "private@example.com", phase: "signup_result", outcome: "rejected" });
    expect(info).toHaveBeenCalledTimes(1);
  });

  it("cannot interrupt authentication if the logging sink throws", () => {
    vi.spyOn(console, "info").mockImplementation(() => { throw new Error("sink unavailable"); });
    expect(() => logAuthDiagnostic({ attemptId, phase: "signup_result", outcome: "accepted" })).not.toThrow();
  });
});
