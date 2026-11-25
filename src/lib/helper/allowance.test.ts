import { beforeEach, describe, expect, it, vi } from "vitest";

const adminRpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: adminRpc }) }));

import { consumeHelperCredits, readHelperCredits, releaseHelperCredits } from "@/lib/helper/allowance";
import { helperCreditCost, helperPack, percentLeft, helperWeekStart, helperWeeklyReset, parseHelperCredits } from "@/lib/helper/credits";
import { withinBudget } from "@/lib/helper/context";
import { helperTier } from "@/lib/helper/tier";

const CHARGE = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-26T15:00:00Z"); // a Thursday

describe("helper credits", () => {
  beforeEach(() => adminRpc.mockReset());

  it("charges the plan's weekly credits through the service-role RPC and maps every status", async () => {
    adminRpc.mockResolvedValueOnce({ data: { status: "ok", charge_id: CHARGE, plan_left: 690, pack_left: 0 }, error: null });
    expect(await consumeHelperCredits("u1", "bank1", 10, NOW)).toEqual({
      status: "ok", charge: { chargeId: CHARGE },
      credits: { tier: "bank1", weekly: 700, planLeft: 690, packLeft: 0, resetsAt: "2026-11-30T00:00:00.000Z" },
    });
    expect(adminRpc).toHaveBeenCalledWith("consume_helper_credits", { p_user_id: "u1", p_weekly_credits: 700, p_cost: 10 });
    adminRpc.mockResolvedValueOnce({ data: { status: "limit", reason: "week", plan_left: 0, pack_left: 0 }, error: null });
    expect(await consumeHelperCredits("u1", "free", 20, NOW)).toMatchObject({ status: "limit", reason: "week", credits: { weekly: 150, planLeft: 0 } });
    for (const status of ["busy", "disabled"]) {
      adminRpc.mockResolvedValueOnce({ data: { status }, error: null });
      expect(await consumeHelperCredits("u1", "free", 10, NOW)).toEqual({ status });
    }
    adminRpc.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    expect(await consumeHelperCredits("u1", "free", 10, NOW)).toEqual({ status: "error" });
    adminRpc.mockRejectedValueOnce(new Error("network"));
    expect(await consumeHelperCredits("u1", "free", 10, NOW)).toEqual({ status: "error" });
  });

  it("refunds by charge id and never throws", async () => {
    adminRpc.mockResolvedValueOnce({ data: true, error: null });
    await releaseHelperCredits("u1", { chargeId: CHARGE });
    expect(adminRpc).toHaveBeenCalledWith("release_helper_credits", { p_user_id: "u1", p_charge_id: CHARGE });
    adminRpc.mockRejectedValueOnce(new Error("network"));
    await expect(releaseHelperCredits("u1", { chargeId: CHARGE })).resolves.toBeUndefined();
  });

  it("reads this week's balance and live packs through the student's own session", async () => {
    const calls: Array<[string, string, unknown]> = [];
    const rows: Record<string, unknown[]> = {
      helper_usage_weekly: [{ credits_used: 760 }],
      helper_credit_packs: [{ credits_remaining: 990, expires_at: "2027-11-01T00:00:00Z" }, { credits_remaining: 0, expires_at: "2027-12-01T00:00:00Z" }],
    };
    const client = { from: (table: string) => {
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { calls.push([table, column, value]); return query; },
        gt: () => query,
        order: () => query,
        then: (resolve: (value: unknown) => unknown) => resolve({ data: rows[table], error: null }),
      };
      return query;
    } };
    expect(await readHelperCredits(client, "u1", "bank1", NOW)).toEqual({
      tier: "bank1", weekly: 700, planLeft: 0, packLeft: 990, resetsAt: "2026-11-30T00:00:00.000Z",
      packs: [{ credits: 990, expiresAt: "2027-11-01T00:00:00Z" }],
    });
    expect(calls).toContainEqual(["helper_usage_weekly", "week_start", "2026-11-23"]);
    rows.helper_usage_weekly = [{ credits_used: -5 }];
    expect(await readHelperCredits(client, "u1", "bank1", NOW)).toBeNull();
  });

  it("weeks start Monday 00:00 UTC", () => {
    expect(helperWeekStart(new Date("2026-11-23T00:00:00Z"))).toBe("2026-11-23");
    expect(helperWeekStart(new Date("2026-11-29T23:59:59Z"))).toBe("2026-11-23");
    expect(helperWeeklyReset(new Date("2026-11-29T23:59:59Z")).toISOString()).toBe("2026-11-30T00:00:00.000Z");
  });

  it("shows this week's plan credits as a percentage left", () => {
    expect(percentLeft({ planLeft: 640, weekly: 1200 })).toBe("53%");
    expect(percentLeft({ planLeft: 700, weekly: 700 })).toBe("100%");
    expect(percentLeft({ planLeft: 10, weekly: 3000 })).toBe("<1%");
    expect(percentLeft({ planLeft: 0, weekly: 150 })).toBe("0%");
  });

  it("prices messages and packs from a fixed list", () => {
    expect([helperCreditCost(false), helperCreditCost(true)]).toEqual([10, 20]);
    expect(helperPack("credits_3000")).toEqual({ id: "credits_3000", credits: 3000, amountCents: 1299 });
    expect(helperPack("credits_9000")).toBeNull();
    expect(parseHelperCredits({ tier: "all", weekly: 3000, planLeft: 1, packLeft: 0, resetsAt: "2026-11-30T00:00:00Z" })).not.toBeNull();
    expect(parseHelperCredits({ tier: "gold", weekly: 3000, planLeft: 1, packLeft: 0, resetsAt: "2026-11-30T00:00:00Z" })).toBeNull();
  });

  it("works out the plan tier from the banks an account can open", () => {
    const banks = [{ slug: "igcse" }, { slug: "ib-hl" }, { slug: "ib-sl" }, { slug: "ib-chemistry-hl" }, { slug: "ib-physics-hl" }, { slug: "igcse-additional" }];
    const row = (productId: string, extra: Record<string, unknown> = {}) => ({ productId, status: "active", startsAt: "2020-01-01T00:00:00Z", expiresAt: null, ...extra }) as never;
    expect(helperTier([], NOW, banks)).toBe("free");
    expect(helperTier([row("bank_igcse")], NOW, banks)).toBe("bank1");
    expect(helperTier([row("bundle_ib_aa")], NOW, banks)).toBe("bank2");
    expect(helperTier([row("bundle_custom", { selectedBankIds: ["igcse", "ib-chemistry-hl", "ib-physics-hl"] })], NOW, banks)).toBe("bank3");
    expect(helperTier([row("bundle_ib_aa"), row("bank_igcse"), row("bank_ib_chemistry_hl")], NOW, banks)).toBe("bank4");
    expect(helperTier([row("bundle_all")], NOW, banks)).toBe("all");
    expect(helperTier([row("lifetime_all_access")], NOW, banks)).toBe("all");
    expect(helperTier([row("bundle_all", { status: "trialing" })], NOW, banks)).toBe("all");
    expect(helperTier([row("bundle_all", { status: "expired" })], NOW, banks)).toBe("free");
    expect(helperTier([row("bundle_all", { expiresAt: "2026-01-01T00:00:00Z" })], NOW, banks)).toBe("free");
  });
});

describe("crop budget", () => {
  it("keeps leading crops that fit and reports what is left", () => {
    expect(withinBudget(["aaaa", "bbbb", "cc"], 9)).toEqual({ kept: ["aaaa", "bbbb"], rest: 1 });
    expect(withinBudget(["aaaa"], 3)).toEqual({ kept: [], rest: 3 });
  });
});
