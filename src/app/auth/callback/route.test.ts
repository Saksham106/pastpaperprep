// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { NextRequest } from "next/server";

const { createClient, exchangeCodeForSession, getUser, bindReferral, captureConversionOutcome } = vi.hoisted(() => ({
  createClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  bindReferral: vi.fn().mockResolvedValue(false),
  captureConversionOutcome: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/referral-account", () => ({ bindReferralToAuthenticatedUser: bindReferral }));
vi.mock("@/lib/server-conversion-analytics", () => ({ captureConversionOutcome }));

import { GET } from "./route";

const request = (query: string) => new NextRequest(`https://pastpaperprep.com/auth/callback?${query}`);

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { exchangeCodeForSession, getUser } });
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it.each(["create", "exchange", "getUser", "provider-error", "missing-code", "invalid-flow", "duplicate-flow"])("fails %s generically with a Google error and safe next", async (failure) => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    if (failure === "create") createClient.mockRejectedValue(new Error("private failure"));
    if (failure === "exchange") exchangeCodeForSession.mockRejectedValue(new Error("private failure"));
    if (failure === "getUser") getUser.mockRejectedValue(new Error("private failure"));
    const query = new URLSearchParams({ provider: "google", next: "/banks/ib-hl", code: "abc", sb_flow_id: "valid-flow-123" });
    if (failure === "provider-error") { query.set("error", "access_denied"); query.set("error_description", "private details"); }
    if (failure === "missing-code") query.delete("code");
    if (failure === "invalid-flow") query.set("sb_flow_id", "../bad");
    if (failure === "duplicate-flow") query.append("sb_flow_id", "other-flow-123");
    const response = await GET(request(query.toString()));
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/login?error=google&next=%2Fbanks%2Fib-hl");
    if (["provider-error", "missing-code", "invalid-flow", "duplicate-flow"].includes(failure)) expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(bindReferral).not.toHaveBeenCalled();
  });

  it.each(["referral", "conversion"])("keeps the established session destination when %s side effects throw", async (failure) => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", created_at: "2026-10-12T10:00:00Z", last_sign_in_at: "2026-10-12T10:00:01Z", app_metadata: { provider: "google" } } } });
    if (failure === "referral") bindReferral.mockRejectedValueOnce(new Error("private failure"));
    else captureConversionOutcome.mockRejectedValueOnce(new Error("private failure"));
    expect((await GET(request("code=abc&provider=google&next=/account"))).headers.get("location")).toBe("https://pastpaperprep.com/account");
    expect(captureConversionOutcome).toHaveBeenCalled();
  });

  it("pins recovery callbacks to password setup even when next is tampered", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { provider: "email" } } } });
    expect((await GET(request("code=abc&type=recovery&next=/banks/ib-hl"))).headers.get("location")).toBe("https://pastpaperprep.com/account/password");
  });

  it("pins SDK-identified recovery without relying on a query marker", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    exchangeCodeForSession.mockResolvedValue({ error: null, data: { redirectType: "recovery" } });
    expect((await GET(request("code=abc&next=/banks/ib-hl"))).headers.get("location")).toBe("https://pastpaperprep.com/account/password");
  });

  it.each([null, { code: "unexpected", message: "private details" }])("rejects a missing or unverifiable user after exchange", async (error) => {
    getUser.mockResolvedValue({ data: { user: error ? { id: "u1" } : null }, error });
    const location = (await GET(request("code=abc&provider=google&next=//evil.example"))).headers.get("location");
    expect(location).toBe("https://pastpaperprep.com/login?error=google&next=%2Fpricing");
    expect(bindReferral).not.toHaveBeenCalled();
  });

  it("counts a first Google sign-in as a confirmed signup and returns to a safe path", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { provider: "google" }, created_at: "2026-10-12T10:00:00Z", last_sign_in_at: "2026-10-12T10:00:01Z" } } });
    const response = await GET(request("code=abc&next=/banks/ib-hl"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(captureConversionOutcome).toHaveBeenCalledWith(expect.objectContaining({ outcome: "signup_confirmed", eventKey: "signup:u1", userId: "u1" }));
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/banks/ib-hl");
  });

  it("does not count returning Google users or email-based callbacks as signups", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { provider: "google" }, created_at: "2026-09-01T10:00:00Z", last_sign_in_at: "2026-10-12T10:00:00Z" } } });
    await GET(request("code=abc&next=/pricing"));
    getUser.mockResolvedValue({ data: { user: { id: "u2", app_metadata: { provider: "email" }, created_at: "2026-10-12T10:00:00Z", last_sign_in_at: "2026-10-12T10:00:00Z" } } });
    await GET(request("code=def&next=/account/password"));
    expect(captureConversionOutcome).not.toHaveBeenCalled();
  });

  it("sends paid users from the default pricing destination to their dashboard, but keeps it for free users", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { provider: "google" }, created_at: "2026-09-01T10:00:00Z", last_sign_in_at: "2026-10-12T10:00:00Z" } } });
    const entitlements = (rows: unknown[]) => ({ from: () => ({ select: () => ({ eq: async () => ({ data: rows, error: null }) }) }), rpc: async () => ({ data: [], error: null }) });
    createClient.mockResolvedValue({ auth: { exchangeCodeForSession, getUser }, ...entitlements([{ product_id: "bundle_all", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]) });
    expect((await GET(request("code=abc&next=/pricing"))).headers.get("location")).toBe("https://pastpaperprep.com/dashboard");
    createClient.mockResolvedValue({ auth: { exchangeCodeForSession, getUser }, ...entitlements([]) });
    expect((await GET(request("code=abc&next=/pricing"))).headers.get("location")).toBe("https://pastpaperprep.com/pricing");
  });

  it("sends failed or missing codes back to login and ignores unsafe next paths", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: "bad_code" } });
    expect((await GET(request("code=abc"))).headers.get("location")).toBe("https://pastpaperprep.com/login?error=callback");
    expect((await GET(request("next=//evil.example"))).headers.get("location")).toBe("https://pastpaperprep.com/login?error=callback");
  });
});
