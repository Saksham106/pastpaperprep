import { annualSaleCents, annualSalePercentForBankCount } from "@/lib/annual-sale";
import { PRICING_MODEL, priceForBankCount, type BillingInterval } from "@/lib/pricing-model";

export type PlanUpgradeNudge = {
  /** Bank count after adding one; 6 means the selection becomes All Access. */
  nextCount: number;
  toAllAccess: boolean;
  /** Extra per month: the real monthly difference, or the annual difference ÷ 12. */
  extraPerMonthCents: number;
  /** Annual only: the extra actually charged up front each year (first year during a sale). */
  extraPerYearCents: number | null;
  /** Sale only: the bigger first-year discount the next step unlocks. */
  unlocksPercentOff: number | null;
};

/** What a plan of `count` banks is charged: the sale's first-year price when it applies. */
function chargeForBankCount(interval: BillingInterval, count: number, saleLive: boolean): number {
  const cents = priceForBankCount(interval, count);
  const percentOff = interval === "annual" ? annualSalePercentForBankCount(count, saleLive) : null;
  return percentOff === null ? cents : annualSaleCents(cents, percentOff);
}

/**
 * "Add one more bank for $X/mo more": the next step up from `count` banks, priced from the real
 * plan prices (and sale prices while the sale is live). Null when there is no step up.
 */
export function planUpgradeNudge(interval: BillingInterval, count: number, saleLive: boolean): PlanUpgradeNudge | null {
  if (!Number.isSafeInteger(count) || count < 1 || count >= PRICING_MODEL.allAccess.minBanks) return null;
  const nextCount = count + 1;
  const extra = chargeForBankCount(interval, nextCount, saleLive) - chargeForBankCount(interval, count, saleLive);
  if (extra <= 0) return null;
  const currentPercent = interval === "annual" ? annualSalePercentForBankCount(count, saleLive) : null;
  const nextPercent = interval === "annual" ? annualSalePercentForBankCount(nextCount, saleLive) : null;
  return {
    nextCount,
    toAllAccess: nextCount >= PRICING_MODEL.allAccess.minBanks,
    extraPerMonthCents: interval === "annual" ? Math.round(extra / 12) : extra,
    extraPerYearCents: interval === "annual" ? extra : null,
    unlocksPercentOff: nextPercent !== null && currentPercent !== null && nextPercent > currentPercent ? nextPercent : null,
  };
}
