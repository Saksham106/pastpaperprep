import "server-only";
import { ANNUAL_SALE, annualSaleCoupon } from "@/lib/annual-sale";

type CouponReader = {
  coupons: { retrieve(id: string, params?: object, options?: { timeout?: number }): Promise<{ id: string; valid?: boolean | null; percent_off?: number | null; amount_off?: number | null; duration?: string | null }> };
};

function stripeErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : undefined;
}

/** The site advertises a sale price this checkout cannot honour (missing or mismatched coupon). */
export class AnnualSaleUnavailableError extends Error {
  constructor() { super("Annual sale coupon is unavailable"); this.name = "AnnualSaleUnavailableError"; }
}

/**
 * The coupon a new annual Checkout Session should carry, or null when the sale does not apply.
 *
 * The coupon is read back so a typo, a deleted coupon or a different percentage never sends a buyer
 * who was shown the sale price to a full-price Checkout: a missing or mismatched coupon fails closed
 * (AnnualSaleUnavailableError) and transient Stripe errors throw, so nothing is created either way.
 */
export async function resolveAnnualSaleCoupon(stripe: CouponReader, interval: "monthly" | "annual", productId: string, bankCount: number | undefined, now: number, environment: Record<string, string | undefined>): Promise<string | null> {
  const sale = annualSaleCoupon(interval, productId, bankCount, now, environment);
  if (!sale) return null;
  const { couponId, percentOff, tier } = sale;
  let coupon: Awaited<ReturnType<CouponReader["coupons"]["retrieve"]>>;
  try {
    coupon = await stripe.coupons.retrieve(couponId, {}, { timeout: 10_000 });
  } catch (error) {
    if (stripeErrorCode(error) === "resource_missing") {
      console.error("Annual sale coupon is missing; checkout stopped", { sale: ANNUAL_SALE.id, tier });
      throw new AnnualSaleUnavailableError();
    }
    throw error;
  }
  if (coupon.valid !== true || coupon.percent_off !== percentOff || coupon.amount_off != null || coupon.duration !== "once") {
    console.error("Annual sale coupon does not match the sale config; checkout stopped", {
      sale: ANNUAL_SALE.id, tier, valid: coupon.valid ?? null, percentOff: coupon.percent_off ?? null, duration: coupon.duration ?? null,
    });
    throw new AnnualSaleUnavailableError();
  }
  return coupon.id;
}

/**
 * Checkout Sessions last 24 hours by default. A sale session expires at the sale's end instead.
 * Stripe requires 30 minutes to 24 hours from now, so a checkout opened in the sale's last
 * 30 minutes stays open until 30 minutes after it started: a short grace period for buyers who
 * began before the cutoff (documented in docs/annual-sale-runbook.md). No new discounted session
 * is created after the end.
 */
export function annualSaleSessionExpiry(now: number): number | undefined {
  const nowSeconds = Math.floor(now / 1000);
  const endSeconds = Math.floor(ANNUAL_SALE.endsAt / 1000);
  const latest = nowSeconds + 24 * 60 * 60 - 60;
  if (endSeconds >= latest) return undefined;
  return Math.max(nowSeconds + 31 * 60, endSeconds);
}
