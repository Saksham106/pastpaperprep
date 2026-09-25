import { describe, expect, it } from "vitest";
import { describeSubscriptionBanks, recurringPriceSubtotal } from "@/lib/account-billing-view";

describe("account billing view", () => {
  it("resolves exact custom bank names instead of guessing from the product price", () => {
    expect(describeSubscriptionBanks("bundle_custom", '["ib-hl","igcse"]')).toMatchObject({ kind: "selected", banks: expect.arrayContaining([expect.objectContaining({ slug: "ib-hl" }), expect.objectContaining({ slug: "igcse" })]) });
  });
  it("identifies existing fixed-bank and All Access products without pretending they are custom bundles", () => {
    expect(describeSubscriptionBanks("bank_ib_hl", null)).toMatchObject({ kind: "selected", banks: [{ slug: "ib-hl" }] });
    expect(describeSubscriptionBanks("bundle_all", null)).toMatchObject({ kind: "all" });
  });
  it("declines to invent banks for invalid or unknown metadata", () => {
    expect(describeSubscriptionBanks("bundle_custom", '["ib-hl","ib-hl"]')).toEqual({ kind: "unknown" });
    expect(describeSubscriptionBanks("some_other_product", null)).toEqual({ kind: "unknown" });
  });
  it("calculates standard and graduated recurring base rate from Stripe prices", () => {
    expect(recurringPriceSubtotal({ billing_scheme: "per_unit", unit_amount: 600, tiers: null }, 2)).toBe(1200);
    expect(recurringPriceSubtotal({ billing_scheme: "tiered", tiers_mode: "graduated", unit_amount: null, tiers: [
      { up_to: 1, unit_amount: 600, flat_amount: 0 },
      { up_to: 2, unit_amount: 400, flat_amount: 0 },
      { up_to: "inf", unit_amount: 400, flat_amount: 0 },
    ] }, 3)).toBe(1400);
  });
  it("refuses to guess the amount when Stripe tier or quantity data is incomplete", () => {
    expect(recurringPriceSubtotal({ billing_scheme: "tiered", tiers_mode: "graduated", unit_amount: null, tiers: null }, 2)).toBeNull();
    expect(recurringPriceSubtotal({ billing_scheme: "per_unit", unit_amount: 600 }, 0)).toBeNull();
  });
});
