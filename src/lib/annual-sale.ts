/**
 * Time-boxed discount on the first year of annual plans, laddered by plan size.
 * Monthly and Lifetime are never discounted.
 *
 * Inert unless the clock is inside [startsAt, endsAt) AND the server has all three coupon env
 * vars. The coupons themselves are created by the owner in Stripe (percent_off = the tier's
 * percentOff, duration=once, redeem_by just after endsAt) — see docs/annual-sale-runbook.md.
 */
export type AnnualSaleTier = "single" | "builder" | "all";

export const ANNUAL_SALE = {
  id: "black-friday-2026",
  name: "Black Friday",
  /** Keep each step monotonic: 5 banks at the builder rate must cost less than All Access. */
  tiers: {
    single: { percentOff: 25, env: "STRIPE_SALE_COUPON_SINGLE", label: "One Bank" },
    builder: { percentOff: 35, env: "STRIPE_SALE_COUPON_BUILDER", label: "Build your plan" },
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

/** Which ladder step a server-resolved product belongs to. Legacy subject pairs count as builder. */
export function annualSaleTierForProduct(productId: string): AnnualSaleTier {
  if (productId.startsWith("bank_")) return "single";
  return productId === "bundle_all" ? "all" : "builder";
}

/** Ladder step for a bank count on the pricing page (6+ banks bill as All Access). */
export function annualSaleTierForBankCount(count: number): AnnualSaleTier {
  return count <= 1 ? "single" : count >= 6 ? "all" : "builder";
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

/** All three coupons are set; a partial setup stays inert so no tier promises a missing discount. */
function allCouponsConfigured(environment: Record<string, string | undefined>): boolean {
  return (Object.keys(ANNUAL_SALE.tiers) as AnnualSaleTier[]).every((tier) => couponIdFor(tier, environment) !== null);
}

/** The coupon (and its expected percent) for a new Checkout Session, or null when the sale does not apply. */
export function annualSaleCoupon(interval: "monthly" | "annual", productId: string, now: number, environment: Record<string, string | undefined>): { couponId: string; percentOff: number; tier: AnnualSaleTier } | null {
  if (interval !== "annual" || !isAnnualSaleWindow(now) || !allCouponsConfigured(environment)) return null;
  const tier = annualSaleTierForProduct(productId);
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
