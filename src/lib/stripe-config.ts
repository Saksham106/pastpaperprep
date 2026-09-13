import { CUSTOM_BUNDLE_PRODUCT_ID, getCustomBundlePlan } from "@/lib/custom-bundles";

export type BillingInterval = "monthly" | "annual";

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  monthlyPriceId: string;
  annualPriceId: string;
  customMonthlyPriceId: string;
  customAnnualPriceId: string;
  singleMonthlyPriceId: string;
  singleAnnualPriceId: string;
  pairMonthlyPriceId: string;
  pairAnnualPriceId: string;
  allMonthlyPriceId: string;
  allAnnualPriceId: string;
  siteUrl: string;
};

type StripeEnvironment = Record<string, string | undefined>;

function required(value: string | undefined): string {
  if (!value || value === "...") throw new Error("Stripe is not configured");
  return value;
}

export function validateStripeConfig(environment: StripeEnvironment): StripeConfig {
  const siteUrl = required(environment.NEXT_PUBLIC_SITE_URL);
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    throw new Error("Invalid site URL");
  }
  if (parsed.protocol !== "https:" || parsed.origin !== "https://pastpaperprep.com") {
    throw new Error("Invalid site URL");
  }

  const secretKey = required(environment.STRIPE_SECRET_KEY);
  const webhookSecret = required(environment.STRIPE_WEBHOOK_SECRET);
  const monthlyPriceId = required(environment.STRIPE_FOUNDING_MONTHLY_PRICE_ID);
  const annualPriceId = required(environment.STRIPE_FOUNDING_ANNUAL_PRICE_ID);
  const customMonthlyPriceId = required(environment.STRIPE_CUSTOM_MONTHLY_PRICE_ID);
  const customAnnualPriceId = required(environment.STRIPE_CUSTOM_ANNUAL_PRICE_ID);
  const singleMonthlyPriceId = required(environment.STRIPE_SINGLE_MONTHLY_PRICE_ID);
  const singleAnnualPriceId = required(environment.STRIPE_SINGLE_ANNUAL_PRICE_ID);
  const pairMonthlyPriceId = required(environment.STRIPE_PAIR_MONTHLY_PRICE_ID);
  const pairAnnualPriceId = required(environment.STRIPE_PAIR_ANNUAL_PRICE_ID);
  const allMonthlyPriceId = required(environment.STRIPE_ALL_MONTHLY_PRICE_ID);
  const allAnnualPriceId = required(environment.STRIPE_ALL_ANNUAL_PRICE_ID);
  const priceIds = [monthlyPriceId, annualPriceId, customMonthlyPriceId, customAnnualPriceId, singleMonthlyPriceId, singleAnnualPriceId, pairMonthlyPriceId, pairAnnualPriceId, allMonthlyPriceId, allAnnualPriceId];
  if (
    (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_"))
    || !webhookSecret.startsWith("whsec_")
    || priceIds.some((priceId) => !priceId.startsWith("price_"))
    || new Set(priceIds).size !== priceIds.length
  ) {
    throw new Error("Invalid Stripe configuration");
  }

  return {
    secretKey,
    webhookSecret,
    monthlyPriceId,
    annualPriceId,
    customMonthlyPriceId,
    customAnnualPriceId,
    singleMonthlyPriceId,
    singleAnnualPriceId,
    pairMonthlyPriceId,
    pairAnnualPriceId,
    allMonthlyPriceId,
    allAnnualPriceId,
    siteUrl: parsed.origin,
  };
}

export function isStripeBillingEnabled(environment: StripeEnvironment = process.env): boolean {
  if (environment.STRIPE_BILLING_ENABLED !== "true") return false;
  if (environment.STRIPE_SECRET_KEY?.startsWith("sk_live_") && environment.STRIPE_LIVE_MODE_ENABLED !== "true") {
    return false;
  }
  return true;
}

export function getStripeConfig(): StripeConfig {
  return validateStripeConfig(process.env);
}

const SINGLE_PRODUCTS = new Set(["bank_igcse", "bank_igcse_additional", "bank_ib_hl", "bank_ib_sl", "bank_ib_ai_hl", "bank_ib_ai_sl", "bank_ib_chemistry_hl", "bank_ib_chemistry_sl", "bank_ib_physics_hl", "bank_ib_physics_sl", "bank_ib_biology_hl", "bank_ib_biology_sl", "bank_igcse_biology_0610", "bank_igcse_economics_0455"]);
const PAIR_PRODUCTS = new Set(["bundle_igcse", "bundle_ib_aa", "bundle_ib_ai", "bundle_ib_chemistry", "bundle_ib_physics", "bundle_ib_biology"]);

export function getBillingPlan(
  productId: unknown,
  interval: unknown,
  config: StripeConfig,
  selectedBankIds?: unknown,
  environment: StripeEnvironment = process.env,
) {
  if (interval !== "monthly" && interval !== "annual") throw new Error("Unknown billing interval");
  if (productId === CUSTOM_BUNDLE_PRODUCT_ID) {
    return getCustomBundlePlan(interval, selectedBankIds, config, environment);
  }
  let priceId: string;
  if (typeof productId === "string" && SINGLE_PRODUCTS.has(productId)) {
    priceId = interval === "monthly" ? config.singleMonthlyPriceId : config.singleAnnualPriceId;
  } else if (typeof productId === "string" && PAIR_PRODUCTS.has(productId)) {
    priceId = interval === "monthly" ? config.pairMonthlyPriceId : config.pairAnnualPriceId;
  } else if (productId === "bundle_all") {
    priceId = interval === "monthly" ? config.allMonthlyPriceId : config.allAnnualPriceId;
  } else {
    throw new Error("Unknown billing product");
  }
  return { interval, productId, priceId } as const;
}

export function getKnownStripePriceIds(config: StripeConfig): ReadonlySet<string> {
  return new Set([
    config.monthlyPriceId, config.annualPriceId,
    config.customMonthlyPriceId, config.customAnnualPriceId,
    config.singleMonthlyPriceId, config.singleAnnualPriceId,
    config.pairMonthlyPriceId, config.pairAnnualPriceId,
    config.allMonthlyPriceId, config.allAnnualPriceId,
  ]);
}

export function isStripePriceAllowedForProduct(productId: string, priceId: string, config: StripeConfig, interval?: BillingInterval): boolean {
  if (!interval) return false;
  if (SINGLE_PRODUCTS.has(productId)) {
    return interval === "monthly"
      ? priceId === config.singleMonthlyPriceId
      : priceId === config.singleAnnualPriceId;
  }
  if (PAIR_PRODUCTS.has(productId)) {
    return interval === "monthly"
      ? priceId === config.pairMonthlyPriceId
      : priceId === config.pairAnnualPriceId;
  }
  if (productId === "bundle_all") {
    return interval === "monthly"
      ? priceId === config.monthlyPriceId || priceId === config.allMonthlyPriceId
      : priceId === config.annualPriceId || priceId === config.allAnnualPriceId;
  }
  if (productId === CUSTOM_BUNDLE_PRODUCT_ID) {
    return interval === "monthly"
      ? priceId === config.customMonthlyPriceId
      : priceId === config.customAnnualPriceId;
  }
  return false;
}
