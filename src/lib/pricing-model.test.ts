import { describe, expect, it } from "vitest";
import { PRICING_MODEL, priceForBankCount } from "@/lib/pricing-model";

describe("canonical pricing model", () => {
  it("keeps the published one, builder, and all-access prices", () => {
    expect(PRICING_MODEL.oneBank.monthlyCents).toBe(600);
    expect(PRICING_MODEL.oneBank.annualCents).toBe(4800);
    expect(PRICING_MODEL.builder.baseMonthlyCents).toBe(1000);
    expect(PRICING_MODEL.builder.baseAnnualCents).toBe(8400);
    expect(PRICING_MODEL.builder.incrementMonthlyCents).toBe(400);
    expect(PRICING_MODEL.builder.incrementAnnualCents).toBe(3600);
    expect(PRICING_MODEL.allAccess.monthlyCents).toBe(2500);
    expect(PRICING_MODEL.allAccess.annualCents).toBe(21600);
  });

  it("derives 2-5 bank builder prices and all access at 6+", () => {
    expect(priceForBankCount("monthly", 2)).toBe(1000);
    expect(priceForBankCount("annual", 5)).toBe(19200);
    expect(priceForBankCount("monthly", 6)).toBe(2500);
  });
});
