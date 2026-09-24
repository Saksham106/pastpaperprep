import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
import { getCheckoutReferral, bindReferralToAuthenticatedUser } from "./referral-account";

function record(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ eq, maybeSingle }));
  return { select: vi.fn(() => ({ eq })), eq, maybeSingle };
}

describe("checkout referral resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T20:00:00Z"));
  });

  it("returns only an active, unexpired account-bound partner", async () => {
    const attribution = record({ partner_code: "pietro", attributed_at: "2026-09-01T20:00:00Z" });
    const partner = record({ code: "pietro" });
    createAdminClient.mockReturnValue({ from: vi.fn((table: string) => table === "referral_attributions" ? attribution : partner) });
    await expect(getCheckoutReferral("user-1")).resolves.toBe("pietro");
  });

  it("uses a database-atomic owner-checked binding rather than a pre-read followed by a direct insert", async () => {
    process.env.REFERRAL_COOKIE_SECRET = "test-secret";
    const { encodeReferral } = await import("./referral");
    const token = encodeReferral("pietro", Date.now() - 1000)!;
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    createAdminClient.mockReturnValue({ rpc, from: vi.fn(() => { throw new Error("Non-atomic binding read"); }) });
    expect(await bindReferralToAuthenticatedUser("00000000-0000-4000-8000-000000000001", new Date().toISOString(), token)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("bind_new_referral_attribution", expect.objectContaining({ p_partner_code: "pietro" }));
  });

  it("rejects expired referrals and inactive partners", async () => {
    const attribution = record({ partner_code: "pietro", attributed_at: "2026-08-01T20:00:00Z" });
    const partner = record(null);
    createAdminClient.mockReturnValue({ from: vi.fn((table: string) => table === "referral_attributions" ? attribution : partner) });
    await expect(getCheckoutReferral("user-1")).resolves.toBeNull();
    attribution.maybeSingle.mockResolvedValue({ data: { partner_code: "pietro", attributed_at: "2026-09-01T20:00:00Z" }, error: null });
    await expect(getCheckoutReferral("user-1")).resolves.toBeNull();
  });
});
