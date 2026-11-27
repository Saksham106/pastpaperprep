/**
 * Time-boxed discount on the first year of annual plans, laddered by plan size.
 * Monthly and Lifetime are never discounted.
 *
 * Inert unless the clock is inside [startsAt, endsAt) AND the server has every tier's coupon env
 * vars. The coupons themselves are created by the owner in Stripe (percent_off = the tier's
 * percentOff, duration=once, redeem_by just after endsAt) — see docs/annual-sale-runbook.md.
 */
export type AnnualSaleTier = "single" | "builderSmall" | "builderLarge" | "all";

export const ANNUAL_SALE = {
  id: "black-friday-2026",
  name: "Black Friday",
  /** Keep each step monotonic: 5 banks at the builder rate must cost less than All Access. */
  tiers: {
    single: { percentOff: 25, env: "STRIPE_SALE_COUPON_SINGLE", label: "One Bank" },
    builderSmall: { percentOff: 30, env: "STRIPE_SALE_COUPON_BUILDER_SMALL", label: "2–3 banks" },
    builderLarge: { percentOff: 35, env: "STRIPE_SALE_COUPON_BUILDER_LARGE", label: "4–5 banks" },
    all: { percentOff: 40, env: "STRIPE_SALE_COUPON_ALL", label: "All Access" },
  },
  startsAt: Date.parse("2026-11-26T00:00:00Z"),
  /** Exclusive: the last sale second is 2026-12-01 23:59:59 UTC. */
  endsAt: Date.parse("2026-12-02T00:00:00Z"),
  /** Shown to buyers; the end is midnight UTC, so name the last full day. */
  endLabel: "1 Dec",
} as const;

export const ANNUAL_SALE_MAX_PERCENT = Math.max(...Object.values(ANNUAL_SALE.tiers).map((tier) => tier.percentOff));

export function isAnnualSaleWindow(now: number, sale: Pick<typeof ANNUAL_SALE, "startsAt" | "endsAt"> = ANNUAL_SALE): boolean {
  return Number.isFinite(now) && now >= sale.startsAt && now < sale.endsAt;
}

/** Ladder step for a bank count (6+ banks bill as All Access). */
export function annualSaleTierForBankCount(count: number): AnnualSaleTier {
  return count <= 1 ? "single" : count <= 3 ? "builderSmall" : count <= 5 ? "builderLarge" : "all";
}

/**
 * Ladder step for a server-resolved plan. `bankCount` is the validated custom-bundle quantity;
 * legacy subject pairs are two banks.
 */
export function annualSaleTierForProduct(productId: string, bankCount?: number): AnnualSaleTier {
  if (productId.startsWith("bank_")) return "single";
  if (productId === "bundle_all") return "all";
  if (productId === "bundle_custom") return annualSaleTierForBankCount(bankCount ?? 0);
  return "builderSmall";
}

/** Percent off the first year for a bank count, or null outside the sale. */
export function annualSalePercentForBankCount(count: number, saleLive: boolean): number | null {
  return saleLive && count >= 1 ? ANNUAL_SALE.tiers[annualSaleTierForBankCount(count)].percentOff : null;
}

/** What Stripe charges for the first year with a percent_off coupon (rounded to the cent). */
export function annualSaleCents(cents: number, percentOff: number): number {
  return Math.round(cents * (100 - percentOff) / 100);
}

/** "$36" for whole dollars, "$54.60" otherwise. */
export function formatSaleCents(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

function couponIdFor(tier: AnnualSaleTier, environment: Record<string, string | undefined>): string | null {
  return environment[ANNUAL_SALE.tiers[tier].env]?.trim() || null;
}

/** Every tier's coupon is set; a partial setup stays inert so no tier promises a missing discount. */
function allCouponsConfigured(environment: Record<string, string | undefined>): boolean {
  return (Object.keys(ANNUAL_SALE.tiers) as AnnualSaleTier[]).every((tier) => couponIdFor(tier, environment) !== null);
}

/** The coupon (and its expected percent) for a new Checkout Session, or null when the sale does not apply. */
export function annualSaleCoupon(interval: "monthly" | "annual", productId: string, bankCount: number | undefined, now: number, environment: Record<string, string | undefined>): { couponId: string; percentOff: number; tier: AnnualSaleTier } | null {
  if (interval !== "annual" || !isAnnualSaleWindow(now) || !allCouponsConfigured(environment)) return null;
  if (productId === "bundle_custom" && (!Number.isSafeInteger(bankCount) || (bankCount ?? 0) < 2)) return null;
  const tier = annualSaleTierForProduct(productId, bankCount);
  return { couponId: couponIdFor(tier, environment)!, percentOff: ANNUAL_SALE.tiers[tier].percentOff, tier };
}

/** Build-time switch for the banner and pricing copy: configured and not already over. */
export function annualSaleConfigured(environment: Record<string, string | undefined>, now: number): boolean {
  return allCouponsConfigured(environment) && now < ANNUAL_SALE.endsAt;
}

/**
 * Inline <head> script: marks <html data-annual-sale="live"> before first paint inside the window,
 * so the static banner shows without a layout shift and hides itself on pages served after the end.
 */
export const ANNUAL_SALE_HINT_SCRIPT = `(function(){try{var n=Date.now();if(n>=${ANNUAL_SALE.startsAt}&&n<${ANNUAL_SALE.endsAt})document.documentElement.setAttribute("data-annual-sale","live")}catch(e){}})();`;

/** Read in the browser: the head script ran (sale configured) and the window is still open. */
export function annualSaleLiveInBrowser(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-annual-sale") === "live" && isAnnualSaleWindow(Date.now());
}
