import { describe, expect, it } from "vitest";
import { ANNUAL_SALE, ANNUAL_SALE_HINT_SCRIPT, ANNUAL_SALE_MAX_PERCENT, annualSaleCents, annualSaleConfigured, annualSaleCoupon, annualSaleTierForBankCount, formatSaleCents, isAnnualSaleWindow } from "@/lib/annual-sale";
import { PRICING_MODEL, priceForBankCount } from "@/lib/pricing-model";

const at = (iso: string) => Date.parse(iso);
const env = { STRIPE_SALE_COUPON_SINGLE: "bf-25", STRIPE_SALE_COUPON_BUILDER: "bf-35", STRIPE_SALE_COUPON_ALL: "bf-40" };
const inside = at("2026-11-28T12:00:00Z");

describe("annual sale", () => {
  it("runs 2026-11-26 00:00 to 2026-12-01 23:59:59 UTC", () => {
    expect(isAnnualSaleWindow(at("2026-11-25T23:59:59.999Z"))).toBe(false);
    expect(isAnnualSaleWindow(at("2026-11-26T00:00:00Z"))).toBe(true);
    expect(isAnnualSaleWindow(at("2026-12-01T23:59:59Z"))).toBe(true);
    expect(isAnnualSaleWindow(at("2026-12-02T00:00:00Z"))).toBe(false);
    expect(isAnnualSaleWindow(Number.NaN)).toBe(false);
  });

  it("ladders the coupon by plan: One Bank 25%, builder and legacy pairs 35%, All Access 40%", () => {
    expect(annualSaleCoupon("annual", "bank_igcse", inside, env)).toEqual({ couponId: "bf-25", percentOff: 25, tier: "single" });
    expect(annualSaleCoupon("annual", "bundle_custom", inside, env)).toEqual({ couponId: "bf-35", percentOff: 35, tier: "builder" });
    expect(annualSaleCoupon("annual", "bundle_ib_aa", inside, env)).toEqual({ couponId: "bf-35", percentOff: 35, tier: "builder" });
    expect(annualSaleCoupon("annual", "bundle_all", inside, env)).toEqual({ couponId: "bf-40", percentOff: 40, tier: "all" });
    expect(ANNUAL_SALE_MAX_PERCENT).toBe(40);
  });

  it("gives no coupon to monthly, outside the window, or with any coupon env var missing", () => {
    expect(annualSaleCoupon("monthly", "bundle_all", inside, env)).toBeNull();
    expect(annualSaleCoupon("annual", "bundle_all", at("2026-12-02T00:00:00Z"), env)).toBeNull();
    expect(annualSaleCoupon("annual", "bundle_all", inside, { ...env, STRIPE_SALE_COUPON_SINGLE: " " })).toBeNull();
    expect(annualSaleCoupon("annual", "bundle_all", inside, {})).toBeNull();
  });

  it("is configured for the banner only with every coupon and before the end", () => {
    expect(annualSaleConfigured(env, at("2026-11-26T09:00:00Z"))).toBe(true);
    expect(annualSaleConfigured({ ...env, STRIPE_SALE_COUPON_ALL: undefined }, at("2026-11-26T09:00:00Z"))).toBe(false);
    expect(annualSaleConfigured(env, ANNUAL_SALE.endsAt)).toBe(false);
  });

  it("prices the first year exactly as each percent_off coupon does", () => {
    const sale = (count: number) => annualSaleCents(priceForBankCount("annual", count), ANNUAL_SALE.tiers[annualSaleTierForBankCount(count)].percentOff);
    expect([1, 2, 3, 4, 5, 6].map(sale)).toEqual([3600, 5460, 7800, 10140, 12480, 12960]);
    expect(annualSaleCents(PRICING_MODEL.allAccess.annualCents, ANNUAL_SALE.tiers.all.percentOff)).toBe(12960);
  });

  it("never makes a bigger plan cheaper than a smaller one", () => {
    const sale = (count: number) => annualSaleCents(priceForBankCount("annual", count), ANNUAL_SALE.tiers[annualSaleTierForBankCount(count)].percentOff);
    for (let count = 1; count < 6; count += 1) expect(sale(count + 1)).toBeGreaterThan(sale(count));
  });

  it("formats sale prices with cents only when needed", () => {
    expect(formatSaleCents(3600)).toBe("$36");
    expect(formatSaleCents(5460)).toBe("$54.60");
    expect(formatSaleCents(12960)).toBe("$129.60");
  });

  it("marks <html> only inside the window", () => {
    const run = (now: number) => {
      const attributes = new Map<string, string>();
      const document = { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value) } };
      new Function("Date", "document", ANNUAL_SALE_HINT_SCRIPT)({ now: () => now }, document);
      return attributes.get("data-annual-sale");
    };
    expect(run(inside)).toBe("live");
    expect(run(at("2026-11-25T12:00:00Z"))).toBeUndefined();
    expect(run(at("2026-12-02T00:00:00Z"))).toBeUndefined();
  });
});
