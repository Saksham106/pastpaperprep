import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, admin, authRpc } = vi.hoisted(() => {
  const admin = { rpc: vi.fn(), from: vi.fn() };
  return { createAdminClient: vi.fn(() => admin), admin, authRpc: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
import { getCustomerReferralSummary } from "./customer-referrals";

const userId = "00000000-0000-4000-8000-000000000001";
const code = "c_111111111111111111111111";

describe("customer referral summary", () => {
  beforeEach(() => {
    admin.rpc.mockReset();
    authRpc.mockReset().mockResolvedValue({ data: code, error: null });
    admin.from.mockReset().mockImplementation((table: string) => ({
      select: (_columns: string, options: unknown) => {
        expect(options).toEqual({ count: "exact", head: true });
        return { eq: (field: string, value: string) => {
          expect(field).toBe("referrer_user_id");
          expect(value).toBe(userId);
          const result = { count: table === "customer_referral_attributions" ? 7 : 1, error: null };
          return Object.assign(Promise.resolve(result), { eq: async (kindField: string, kind: string) => {
            expect(kindField).toBe("kind");
            expect(kind).toBe("five_signups");
            return { count: 1, error: null };
          } });
        } };
      },
    }));
  });

  it("keeps completed five-signup milestones visible until an award is actually recorded", async () => {
    const summary = await getCustomerReferralSummary(userId, { rpc: authRpc } as never);
    expect(summary?.verifiedSignups).toBe(7);
    expect(summary?.awardedSignupMilestones).toBe(1);
    expect(admin.from).toHaveBeenCalledWith("customer_referral_awards");
  });

  it("creates one stable link and counts only verified attributions and recorded awards", async () => {
    const summary = await getCustomerReferralSummary(userId, { rpc: authRpc } as never);
    expect(authRpc).toHaveBeenCalledWith("ensure_customer_referral_link", { p_code: expect.stringMatching(/^c_[a-f0-9]{24}$/) });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(summary).toEqual({ code, verifiedSignups: 7, awardedRewards: 1, awardedSignupMilestones: 1 });
    expect(admin.from).toHaveBeenCalledWith("customer_referral_attributions");
    expect(admin.from).toHaveBeenCalledWith("customer_referral_awards");
  });

  it("does not create a link for a partner or unverified account", async () => {
    authRpc.mockResolvedValue({ data: null, error: null });
    expect(await getCustomerReferralSummary(userId, { rpc: authRpc } as never)).toBeNull();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("fails closed when a count cannot be read", async () => {
    admin.from.mockImplementation(() => ({ select: () => ({ eq: () => Object.assign(Promise.resolve({ count: null, error: { message: "no access" } }), { eq: async () => ({ count: null, error: { message: "no access" } }) }) }) }));
    await expect(getCustomerReferralSummary(userId, { rpc: authRpc } as never)).rejects.toThrow("Could not read referral progress");
  });
});
