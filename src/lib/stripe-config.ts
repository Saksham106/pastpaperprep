export type BillingInterval = "monthly" | "annual";

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  monthlyPriceId: string;
  annualPriceId: string;
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
  if (
    (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_"))
    || !webhookSecret.startsWith("whsec_")
    || !monthlyPriceId.startsWith("price_")
    || !annualPriceId.startsWith("price_")
    || monthlyPriceId === annualPriceId
  ) {
    throw new Error("Invalid Stripe configuration");
  }

  return {
    secretKey,
    webhookSecret,
    monthlyPriceId,
    annualPriceId,
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

export function getBillingPlan(interval: unknown, config: StripeConfig) {
  if (interval === "monthly") return { interval, priceId: config.monthlyPriceId } as const;
  if (interval === "annual") return { interval, priceId: config.annualPriceId } as const;
  throw new Error("Unknown billing interval");
}
