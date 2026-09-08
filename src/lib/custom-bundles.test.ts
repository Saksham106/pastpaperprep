import { describe, expect, it } from "vitest";
import {
  CUSTOM_BUNDLE_PRODUCT_ID,
  getCustomBundlePlan,
  getGraduatedBundlePrice,
  validateCustomBankIds,
} from "@/lib/custom-bundles";
import type { StripeConfig } from "@/lib/stripe-config";

const config = {
  customMonthlyPriceId: "price_custom_monthly",
  customAnnualPriceId: "price_custom_annual",
  allMonthlyPriceId: "price_all_monthly",
  allAnnualPriceId: "price_all_annual",
} as StripeConfig;

const banks = ["ib-sl", "igcse", "ib-hl"] as const;

describe("custom bank bundle pricing", () => {
  it("uses the approved graduated monthly prices for one through five banks", () => {
    expect([1, 2, 3, 4, 5].map((quantity) => getGraduatedBundlePrice("monthly", quantity))).toEqual([
      600, 1000, 1400, 1800, 2200,
    ]);
  });

  it("uses annual effective monthly prices and yearly totals", () => {
    expect([1, 2, 3, 4, 5].map((quantity) => getGraduatedBundlePrice("annual", quantity))).toEqual([
      4800, 8400, 12000, 15600, 19200,
    ]);
  });

  it("resolves six or more selected banks to all access", () => {
    expect(getCustomBundlePlan("monthly", ["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"], config))
      .toEqual({ interval: "monthly", productId: "bundle_all", priceId: "price_all_monthly", quantity: 1 });
  });

  it("derives the custom Stripe price and quantity server-side", () => {
    expect(getCustomBundlePlan("annual", banks, config)).toEqual({
      interval: "annual",
      productId: CUSTOM_BUNDLE_PRODUCT_ID,
      priceId: "price_custom_annual",
      quantity: 3,
      selectedBankIds: ["ib-hl", "ib-sl", "igcse"],
    });
  });

  it("rejects duplicate, unknown, empty, and oversized custom selections", () => {
    expect(() => validateCustomBankIds(["igcse", "igcse"])).toThrow("Duplicate bank");
    expect(() => validateCustomBankIds(["not-a-bank"])).toThrow("Unknown bank");
    expect(() => validateCustomBankIds([])).toThrow("Select at least one bank");
    expect(() => validateCustomBankIds(["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"])).toThrow("Select no more than five banks");
  });
});
