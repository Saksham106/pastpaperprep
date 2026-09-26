import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, redirect, getCustomerReferralSummary } = vi.hoisted(() => ({
  createClient: vi.fn(), redirect: vi.fn(), getCustomerReferralSummary: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/customer-referrals", () => ({ getCustomerReferralSummary }));
import ReferralsPage from "./page";

const userId = "00000000-0000-4000-8000-000000000001";
const code = "c_111111111111111111111111";

describe("account referrals", () => {
  beforeEach(() => {
    createClient.mockReset().mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: { sub: userId } } }) } });
    getCustomerReferralSummary.mockReset().mockResolvedValue({ code, verifiedSignups: 5, awardedRewards: 0, awardedSignupMilestones: 0 });
    redirect.mockReset().mockImplementation(() => { throw new Error("redirect"); });
  });

  it("shows a shareable link, truthful 5/5 pending milestone and manual billing terms", async () => {
    const html = renderToStaticMarkup(await ReferralsPage());
    expect(getCustomerReferralSummary).toHaveBeenCalledWith(userId, expect.objectContaining({ auth: expect.anything() }));
    expect(html).toContain(`https://pastpaperprep.com/invite/${code}`);
    expect(html).toContain("5 / 5");
    expect(html).toMatch(/review/i);
    expect(html).toMatch(/future bill/i);
    expect(html).toMatch(/annual/i);
    expect(html).not.toMatch(/friend.*email/i);
    expect(html).not.toMatch(/clicks/i);
  });

  it("does not expose a consumer link to a partner account", async () => {
    getCustomerReferralSummary.mockResolvedValue(null);
    const html = renderToStaticMarkup(await ReferralsPage());
    expect(html).not.toContain("/invite/");
    expect(html).toMatch(/not available/i);
  });

  it("does not query referrals when the auth subject is lost", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: null } }) } });
    await expect(ReferralsPage()).rejects.toThrow("redirect");
    expect(redirect).toHaveBeenCalledWith("/login?next=/account/referrals");
    expect(getCustomerReferralSummary).not.toHaveBeenCalled();
  });
});
