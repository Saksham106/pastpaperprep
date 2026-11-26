import "server-only";
import { ANNUAL_SALE, annualSaleCoupon } from "@/lib/annual-sale";

type CouponReader = {
  coupons: { retrieve(id: string, params?: object, options?: { timeout?: number }): Promise<{ id: string; valid?: boolean | null; percent_off?: number | null; amount_off?: number | null; duration?: string | null }> };
};

function stripeErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : undefined;
}

/**
 * The coupon a new annual Checkout Session should carry, or null for full price.
 *
 * The coupon is read back so a typo, a deleted coupon or a different percentage never charges
 * buyers something other than the price the pricing page shows; a misconfigured coupon falls
 * back to the normal checkout (promotion codes allowed). Transient Stripe errors throw so the
 * buyer retries instead of silently losing the sale price.
 */
export async function resolveAnnualSaleCoupon(stripe: CouponReader, interval: "monthly" | "annual", productId: string, now: number, environment: Record<string, string | undefined>): Promise<string | null> {
  const sale = annualSaleCoupon(interval, productId, now, environment);
  if (!sale) return null;
  const { couponId, percentOff, tier } = sale;
  let coupon: Awaited<ReturnType<CouponReader["coupons"]["retrieve"]>>;
  try {
    coupon = await stripe.coupons.retrieve(couponId, {}, { timeout: 10_000 });
  } catch (error) {
    if (stripeErrorCode(error) === "resource_missing") {
      console.error("Annual sale coupon is missing; checkout continues at full price", { sale: ANNUAL_SALE.id, tier });
      return null;
    }
    throw error;
  }
  if (coupon.valid !== true || coupon.percent_off !== percentOff || coupon.amount_off != null || coupon.duration !== "once") {
    console.error("Annual sale coupon does not match the sale config; checkout continues at full price", {
      sale: ANNUAL_SALE.id, tier, valid: coupon.valid ?? null, percentOff: coupon.percent_off ?? null, duration: coupon.duration ?? null,
    });
    return null;
  }
  return coupon.id;
}

/**
 * Checkout Sessions last 24 hours by default. A sale session expires at the sale's end instead
 * (Stripe requires 30 minutes to 24 hours from now), so nobody completes a discounted
 * checkout long after the sale closes.
 */
export function annualSaleSessionExpiry(now: number): number | undefined {
  const nowSeconds = Math.floor(now / 1000);
  const endSeconds = Math.floor(ANNUAL_SALE.endsAt / 1000);
  const latest = nowSeconds + 24 * 60 * 60 - 60;
  if (endSeconds >= latest) return undefined;
  return Math.max(nowSeconds + 31 * 60, endSeconds);
}
