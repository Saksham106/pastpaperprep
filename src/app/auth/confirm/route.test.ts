import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient, verifyOtp } = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "./route";

const tokenHash = "a".repeat(64);

function request(query: string) {
  return new NextRequest(`https://pastpaperprep.com/auth/confirm?${query}`);
}

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { verifyOtp } });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("verifies scanner-safe email tokens and preserves a safe pricing path", async () => {
    const next = encodeURIComponent("/pricing?interval=annual&product=bundle_all");
    const response = await GET(request(`token_hash=${tokenHash}&type=email&next=${next}`));

    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: tokenHash });
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/pricing?interval=annual&product=bundle_all");
  });

  it("verifies first-time signup tokens and preserves a safe pricing path", async () => {
    const next = encodeURIComponent("/pricing?interval=monthly&product=single");
    const response = await GET(request(`token_hash=${tokenHash}&type=signup&next=${next}`));

    expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: tokenHash });
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/pricing?interval=monthly&product=single");
  });

  it("pins recovery tokens to the password page", async () => {
    const response = await GET(request(`token_hash=${tokenHash}&type=recovery&next=%2Fpricing`));

    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: tokenHash });
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/account/password");
  });

  it("pins invite tokens to password setup", async () => {
    const response = await GET(request(`token_hash=${tokenHash}&type=invite&next=%2Fpricing`));

    expect(verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: tokenHash });
    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/account/password?invited=1");
  });

  it.each(["magiclink", "email_change", "unknown"])(
    "rejects the %s OTP flow before verification",
    async (type) => {
      const response = await GET(request(`token_hash=${tokenHash}&type=${type}&next=%2Fpricing`));

      expect(verifyOtp).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe("https://pastpaperprep.com/login?error=confirmation");
    },
  );

  it("rejects malformed token hashes and unsafe email redirects", async () => {
    const malformed = await GET(request("token_hash=short&type=email&next=%2Fpricing"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(malformed.headers.get("location")).toBe("https://pastpaperprep.com/login?error=confirmation");

    const unsafe = await GET(request(`token_hash=${tokenHash}&type=email&next=${encodeURIComponent("//evil.example")}`));
    expect(unsafe.headers.get("location")).toBe("https://pastpaperprep.com/pricing");
  });

  it("fails closed when Supabase rejects the token", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const response = await GET(request(`token_hash=${tokenHash}&type=email&next=%2Fpricing`));

    expect(response.headers.get("location")).toBe("https://pastpaperprep.com/login?error=confirmation");
  });
});
