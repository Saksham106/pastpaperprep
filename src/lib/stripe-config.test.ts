import { describe, expect, it } from "vitest";
import { getBillingPlan, isStripeBillingEnabled, validateStripeConfig } from "@/lib/stripe-config";

describe("Stripe billing configuration", () => {
  const env = {
    STRIPE_SECRET_KEY: "sk_test_example",
    STRIPE_WEBHOOK_SECRET: "whsec_example",
    STRIPE_FOUNDING_MONTHLY_PRICE_ID: "price_monthly",
    STRIPE_FOUNDING_ANNUAL_PRICE_ID: "price_annual",
    STRIPE_SINGLE_MONTHLY_PRICE_ID: "price_single_monthly",
    STRIPE_SINGLE_ANNUAL_PRICE_ID: "price_single_annual",
    STRIPE_PAIR_MONTHLY_PRICE_ID: "price_pair_monthly",
    STRIPE_PAIR_ANNUAL_PRICE_ID: "price_pair_annual",
    STRIPE_ALL_MONTHLY_PRICE_ID: "price_all_monthly",
    STRIPE_ALL_ANNUAL_PRICE_ID: "price_all_annual",
    NEXT_PUBLIC_SITE_URL: "https://pastpaperprep.com",
  };

  it("maps only allowlisted billing intervals to server-owned prices", () => {
    const config = validateStripeConfig(env);

    expect(getBillingPlan("bank_ib_hl", "monthly", config)).toEqual({ interval: "monthly", productId: "bank_ib_hl", priceId: "price_single_monthly" });
    expect(getBillingPlan("bank_ib_physics_hl", "annual", config)).toEqual({ interval: "annual", productId: "bank_ib_physics_hl", priceId: "price_single_annual" });
    expect(getBillingPlan("bundle_ib_aa", "annual", config)).toEqual({ interval: "annual", productId: "bundle_ib_aa", priceId: "price_pair_annual" });
    expect(getBillingPlan("bundle_ib_physics", "monthly", config)).toEqual({ interval: "monthly", productId: "bundle_ib_physics", priceId: "price_pair_monthly" });
    expect(getBillingPlan("bank_ib_biology_hl", "monthly", config)).toEqual({ interval: "monthly", productId: "bank_ib_biology_hl", priceId: "price_single_monthly" });
    expect(getBillingPlan("bundle_ib_biology", "annual", config)).toEqual({ interval: "annual", productId: "bundle_ib_biology", priceId: "price_pair_annual" });
    expect(getBillingPlan("bundle_all", "annual", config)).toEqual({ interval: "annual", productId: "bundle_all", priceId: "price_all_annual" });
    expect(() => getBillingPlan("admin", "monthly", config)).toThrow("Unknown billing product");
    expect(() => getBillingPlan("bank_ib_hl", "price_monthly", config)).toThrow("Unknown billing interval");
  });

  it("fails closed when required secrets or price IDs are missing", () => {
    expect(() => validateStripeConfig({ ...env, STRIPE_SECRET_KEY: "" })).toThrow("Stripe is not configured");
    expect(() => validateStripeConfig({ ...env, STRIPE_FOUNDING_ANNUAL_PRICE_ID: "" })).toThrow("Stripe is not configured");
    expect(() => validateStripeConfig({ ...env, STRIPE_SINGLE_ANNUAL_PRICE_ID: "" })).toThrow("Stripe is not configured");
  });

  it("requires the canonical HTTPS site URL", () => {
    expect(() => validateStripeConfig({ ...env, NEXT_PUBLIC_SITE_URL: "http://pastpaperprep.com" })).toThrow("Invalid site URL");
    expect(() => validateStripeConfig({ ...env, NEXT_PUBLIC_SITE_URL: "https://evil.example" })).toThrow("Invalid site URL");
  });

  it("requires valid, distinct Stripe identifiers", () => {
    expect(() => validateStripeConfig({ ...env, STRIPE_FOUNDING_ANNUAL_PRICE_ID: "price_monthly" })).toThrow("Invalid Stripe configuration");
    expect(() => validateStripeConfig({ ...env, STRIPE_FOUNDING_MONTHLY_PRICE_ID: "monthly" })).toThrow("Invalid Stripe configuration");
    expect(() => validateStripeConfig({ ...env, STRIPE_WEBHOOK_SECRET: "secret" })).toThrow("Invalid Stripe configuration");
  });

  it("keeps billing disabled by default and requires an explicit live-mode override", () => {
    expect(isStripeBillingEnabled(env)).toBe(false);
    expect(isStripeBillingEnabled({ ...env, STRIPE_BILLING_ENABLED: "true" })).toBe(true);
    expect(isStripeBillingEnabled({
      ...env,
      STRIPE_BILLING_ENABLED: "true",
      STRIPE_SECRET_KEY: "sk_live_example",
    })).toBe(false);
    expect(isStripeBillingEnabled({
      ...env,
      STRIPE_BILLING_ENABLED: "true",
      STRIPE_LIVE_MODE_ENABLED: "true",
      STRIPE_SECRET_KEY: "sk_live_example",
    })).toBe(true);
  });
});
