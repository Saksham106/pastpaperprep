import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { bindReferral, captureConversionOutcome } = vi.hoisted(() => ({
  bindReferral: vi.fn(), captureConversionOutcome: vi.fn(),
}));
vi.mock("@/lib/referral-account", () => ({ bindReferralToAuthenticatedUser: bindReferral }));
vi.mock("@/lib/server-conversion-analytics", () => ({ captureConversionOutcome }));
import { completeEmailVerification } from "./email-verification";
const user = { id: "verified-user", created_at: "2026-10-12T00:00:00Z", email_confirmed_at: "2026-10-12T00:01:00Z" };
function client() {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } } as unknown as Parameters<typeof completeEmailVerification>[0];
}
describe("post-verification ancillary completion", () => {
  beforeEach(() => { vi.resetAllMocks(); bindReferral.mockResolvedValue(false); captureConversionOutcome.mockResolvedValue(undefined); });
  it("allows completion without attribution when the post-verification user lookup throws", async () => {
    const supabase = client();
    vi.mocked(supabase.auth.getUser).mockRejectedValue(new Error("private lookup failure"));
    await expect(completeEmailVerification(supabase, "signup", undefined)).resolves.toBeUndefined();
    expect(bindReferral).not.toHaveBeenCalled();
    expect(captureConversionOutcome).not.toHaveBeenCalled();
  });
  it("allows completion when conversion transport throws", async () => {
    captureConversionOutcome.mockRejectedValue(new Error("private analytics failure"));
    await expect(completeEmailVerification(client(), "signup", undefined)).resolves.toBe("verified-user");
  });
  it("does not strand a verified session or suppress conversion when referral transport throws", async () => {
    bindReferral.mockRejectedValue(new Error("private transport failure"));
    await expect(completeEmailVerification(client(), "signup", "signed-referral")).resolves.toBe("verified-user");
    expect(captureConversionOutcome).toHaveBeenCalledWith({ outcome: "signup_confirmed", eventKey: "signup:verified-user", userId: user.id, occurredAt: user.email_confirmed_at });
  });
});
