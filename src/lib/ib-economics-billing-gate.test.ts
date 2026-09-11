import { afterEach, describe, expect, it, vi } from "vitest";
import { getBillingBanks, getAvailableBanks } from "@/lib/banks";
import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { getBillingPlan, type StripeConfig } from "@/lib/stripe-config";

const config: StripeConfig = {
  secretKey: "«redacted:sk_test_…»",
  webhookSecret: "whsec_example",
  monthlyPriceId: "price_monthly",
  annualPriceId: "price_annual",
  customMonthlyPriceId: "price_custom_monthly",
  customAnnualPriceId: "price_custom_annual",
  singleMonthlyPriceId: "price_single_monthly",
  singleAnnualPriceId: "price_single_annual",
  pairMonthlyPriceId: "price_pair_monthly",
  pairAnnualPriceId: "price_pair_annual",
  allMonthlyPriceId: "price_all_monthly",
  allAnnualPriceId: "price_all_annual",
  siteUrl: "https://pastpaperprep.com",
};

const economicsEnabled = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "true",
  PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "true",
};

const economicsPaused = {
  NODE_ENV: "production",
  PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION: "false",
  PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED: "false",
};

const current = (productId: AccessEntitlement["productId"]): AccessEntitlement => ({
  productId,
  status: "active",
  startsAt: "2026-01-01T00:00:00Z",
  expiresAt: null,
});

describe("IB Economics billing gate", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("keeps Economics out of discovery and custom checkout until both release gates are on", () => {
    expect(getBillingBanks(economicsPaused).map((bank) => bank.slug)).not.toContain("ib-economics-hl");
    expect(getAvailableBanks(economicsPaused).map((bank) => bank.slug)).not.toContain("ib-economics-hl");
    expect(getBillingBanks(economicsEnabled).map((bank) => bank.slug)).toEqual([
      ...getBillingBanks(economicsPaused).map((bank) => bank.slug),
      "ib-economics-hl",
      "ib-economics-sl",
    ]);
    expect(getBillingPlan("bundle_custom", "annual", config, ["ib-economics-sl", "ib-hl"], economicsEnabled)).toEqual({
      interval: "annual",
      productId: "bundle_custom",
      priceId: "price_custom_annual",
      quantity: 2,
      selectedBankIds: ["ib-economics-sl", "ib-hl"],
    });
    expect(() => getBillingPlan("bundle_custom", "annual", config, ["ib-economics-sl"], economicsPaused)).toThrow("Bank is not available for checkout");
  });

  it("uses only the existing custom and all-access prices for Economics", () => {
    expect(() => getBillingPlan("bank_ib_economics_hl", "monthly", config, undefined, economicsEnabled)).toThrow("Unknown billing product");
    expect(() => getBillingPlan("bundle_ib_economics", "monthly", config, undefined, economicsEnabled)).toThrow("Unknown billing product");
    expect(getBillingPlan("bundle_all", "monthly", config, undefined, economicsPaused)).toEqual({
      interval: "monthly",
      productId: "bundle_all",
      priceId: "price_all_monthly",
    });
    expect(getBillingPlan("bundle_custom", "monthly", config, ["ib-hl", "ib-sl"], economicsPaused)).toEqual({
      interval: "monthly",
      productId: "bundle_custom",
      priceId: "price_custom_monthly",
      quantity: 2,
      selectedBankIds: ["ib-hl", "ib-sl"],
    });
  });

  it("preserves current all-access entitlement semantics while Economics discovery is paused", () => {
    expect(getBillingPlan("bank_ib_hl", "monthly", config, undefined, economicsPaused).productId).toBe("bank_ib_hl");
    expect(getBillingPlan("bundle_ib_biology", "annual", config, undefined, economicsPaused).productId).toBe("bundle_ib_biology");
    expect(hasBankAccess("ib-hl", [current("bundle_all")])).toBe(true);
    expect(hasBankAccess("ib-economics-hl", [current("bundle_all")])).toBe(true);
  });

  it("lets a verified release extend All Access without changing the existing entitlement", () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "true");
    vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "true");
    expect(hasBankAccess("ib-economics-hl", [current("bundle_all")])).toBe(true);
  });
});
