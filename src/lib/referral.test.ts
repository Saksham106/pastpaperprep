import { describe, expect, it } from "vitest";
import { REFERRAL_COOKIE, decodeReferral, encodeReferral, referralCookie } from "@/lib/referral";

describe("referral attribution primitives", () => {
  it("issues an HttpOnly first-party cookie for exactly 30 days", () => {
    process.env.REFERRAL_COOKIE_SECRET = "test-only-secret";
    expect(REFERRAL_COOKIE).toBe("ppp_referral");
    const signed = encodeReferral("pietro")!;
    expect(referralCookie(signed)).toEqual({ name: "ppp_referral", value: signed, maxAge: 2_592_000, httpOnly: true, sameSite: "lax", path: "/", secure: true });
    expect(() => referralCookie("pietro")).toThrow("Invalid signed referral");
  });
  it("authenticates and expires signed referral cookies", () => {
    process.env.REFERRAL_COOKIE_SECRET = "test-only-secret";
    const signed = encodeReferral("pietro", 1_800_000_000_000)!;
    expect(decodeReferral(signed, 1_800_000_001_000)).toEqual({ code: "pietro", attributedAt: 1_800_000_000_000 });
    expect(decodeReferral("pietro", 1_800_000_001_000)).toBeNull();
    expect(decodeReferral(encodeReferral("pietro", 1_700_000_000_000)!, 1_800_000_001_000)).toBeNull();
  });
});
