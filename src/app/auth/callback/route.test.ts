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

  it("sends failed or missing codes back to login and ignores unsafe next paths", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: "bad_code" } });
    expect((await GET(request("code=abc"))).headers.get("location")).toBe("https://pastpaperprep.com/login?error=callback");
    expect((await GET(request("next=//evil.example"))).headers.get("location")).toBe("https://pastpaperprep.com/login?error=callback");
  });
});
