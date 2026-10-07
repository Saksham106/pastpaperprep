import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
afterEach(() => vi.restoreAllMocks());
import { NextRequest } from "next/server";

const { createClient, verifyOtp, getUser } = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
}));
const { captureConversionOutcome } = vi.hoisted(() => ({ captureConversionOutcome: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/referral-account", () => ({ bindReferralToAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/server-conversion-analytics", () => ({ captureConversionOutcome }));

import { GET, HEAD, POST } from "./route";

const tokenHash = "a".repeat(64);


function postRequest(body: Record<string, string>) {
  return new NextRequest("https://pastpaperprep.com/auth/confirm", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
}

function postQuery(query: string) {
  return postRequest(Object.fromEntries(new URLSearchParams(query)));
}

describe("POST /auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: null } });
    createClient.mockResolvedValue({ auth: { verifyOtp, getUser } });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("verifies scanner-safe email tokens and preserves a safe pricing path", async () => {
    const response = await POST(postRequest({ token_hash: tokenHash, type: "email", next: "/pricing?interval=annual&product=bundle_all" }));

    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: tokenHash });
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/pricing?interval=annual&product=bundle_all");
  });

  it("verifies first-time signup tokens and preserves a safe pricing path", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-123", created_at: "2026-01-01T00:00:00Z" } } });
    const next = encodeURIComponent("/pricing?interval=monthly&product=single");
    const response = await POST(postQuery(`token_hash=${tokenHash}&type=signup&next=${next}`));

    expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: tokenHash });
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/pricing?interval=monthly&product=single");
    expect(captureConversionOutcome).toHaveBeenCalledWith({ outcome: "signup_confirmed", eventKey: "signup:user-123", userId: "user-123", occurredAt: "2026-01-01T00:00:00Z" });
  });

  it("does not count regular email confirmation or failed signup verification as a signup", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-123", created_at: "2026-01-01T00:00:00Z" } } });
    await POST(postQuery(`token_hash=${tokenHash}&type=email`));
    verifyOtp.mockResolvedValueOnce({ error: new Error("invalid token") });
    await POST(postQuery(`token_hash=${tokenHash}&type=signup`));
    expect(captureConversionOutcome).not.toHaveBeenCalled();
  });

  it("pins recovery tokens to the password page", async () => {
    const response = await POST(postQuery(`token_hash=${tokenHash}&type=recovery&next=%2Fpricing`));

    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: tokenHash });
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/account/password");
  });

  it.each(["invite", "magiclink", "email_change", "unknown"])(
    "rejects the %s OTP flow before verification",
    async (type) => {
      const response = await POST(postQuery(`token_hash=${tokenHash}&type=${type}&next=%2Fpricing`));

      expect(verifyOtp).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe("https://pastpaperprep.com/login?error=confirmation");
    },
  );

  it("rejects malformed token hashes and unsafe email redirects", async () => {
    const malformed = await POST(postQuery("token_hash=short&type=email&next=%2Fpricing"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(malformed.headers.get("location")).toBe("https://pastpaperprep.com/login?error=confirmation");

    const unsafe = await POST(postQuery(`token_hash=${tokenHash}&type=email&next=${encodeURIComponent("//evil.example")}`));
    expect(unsafe.headers.get("location")).toBe("https://pastpaperprep.com/pricing");
  });

  it("fails closed when Supabase rejects the token", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const response = await POST(postQuery(`token_hash=${tokenHash}&type=email&next=%2Fpricing`));

    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/login?error=confirmation");
  });
});

describe("POST /auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: null } });
    createClient.mockResolvedValue({ auth: { verifyOtp, getUser } });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("redeems only on explicit POST and redirects with 303", async () => {
    const response = await POST(postRequest({ token_hash: tokenHash, type: "email", next: "/pricing" }));
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: tokenHash });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/pricing");
  });

  it("does not redeem on GET or HEAD", async () => {
    const get = await GET();
    const head = await HEAD();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(get.status).not.toBe(303);
    expect(head.status).not.toBe(303);
  });

  it("fails closed when the request body cannot be parsed", async () => {
    const malformed = new NextRequest("https://pastpaperprep.com/auth/confirm", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=bad" },
      body: "not-a-valid-multipart-body",
    });
    const response = await POST(malformed);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/login?error=confirmation");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("fails closed when the same token is submitted under an unrelated OTP type", async () => {
    await POST(postRequest({ token_hash: tokenHash, type: "email", next: "/pricing" }));
    verifyOtp.mockResolvedValueOnce({ error: new Error("otp_expired") });
    const response = await POST(postRequest({ token_hash: tokenHash, type: "recovery" }));
    expect(verifyOtp).toHaveBeenLastCalledWith({ type: "recovery", token_hash: tokenHash });
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/login?error=confirmation");
  });
  it("fails closed when a stale different token is submitted", async () => {
    await POST(postRequest({ token_hash: tokenHash, type: "email", next: "/pricing" }));
    verifyOtp.mockResolvedValueOnce({ error: new Error("otp_expired") });
    const response = await POST(postRequest({ token_hash: "b".repeat(64), type: "email", next: "/pricing" }));
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/login?error=confirmation");
  });

  it("correlates successful confirmation with issuance without logging the token", async () => {
    const attemptId = "30be40c9-7a0a-4250-8615-7b929938a620";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await POST(postRequest({ token_hash: tokenHash, type: "signup", auth_attempt: attemptId }));
    expect(info).toHaveBeenCalledWith({ event: "auth_flow", attemptId, phase: "confirmation_requested" });
    expect(info).toHaveBeenCalledWith({ event: "auth_flow", attemptId, phase: "confirmation_result", outcome: "verified" });
    expect(JSON.stringify(info.mock.calls)).not.toContain(tokenHash);
  });

  it("records a rejected provider code without raw error text or token values", async () => {
    const attemptId = "30be40c9-7a0a-4250-8615-7b929938a620";
    const info = vi.spyOn(console, "warn").mockImplementation(() => {});
    verifyOtp.mockResolvedValueOnce({ error: { code: "otp_expired", message: "private@example.com private-token" } });
    const response = await POST(postRequest({ token_hash: tokenHash, type: "signup", auth_attempt: attemptId }));
    expect(response.headers.get("location")).toContain("error=confirmation");
    expect(info).toHaveBeenCalledWith({ event: "auth_flow", attemptId, phase: "confirmation_result", outcome: "rejected", providerCode: "otp_expired" });
    expect(JSON.stringify(info.mock.calls)).not.toMatch(/private|aaaaaaaa/);
  });

  it("fails closed and records a bounded outcome when verification throws", async () => {
    const info = vi.spyOn(console, "error").mockImplementation(() => {});
    verifyOtp.mockRejectedValueOnce(new Error("private network failure"));
    const response = await POST(postRequest({ token_hash: tokenHash, type: "signup" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("error=confirmation");
    expect(info).toHaveBeenCalledWith(expect.objectContaining({ phase: "confirmation_result", outcome: "rejected", providerCode: "unexpected_failure" }));
    expect(JSON.stringify(info.mock.calls)).not.toContain("private");
  });
});
