import { hasBankAccess, type ProductId } from "@/lib/access";
import { getEntitlementBanks, type BankSlug } from "@/lib/banks";
import { validateCustomBankIds } from "@/lib/custom-bundles";

export type BankDescription =
  | { kind: "all" }
  | { kind: "selected"; banks: { slug: BankSlug; name: string }[] }
  | { kind: "unknown" };

/** Billing display is deliberately independent of current entitlement status. */
export function describeSubscriptionBanks(productId: string | null, selectedBankIds: string | null): BankDescription {
  if (productId === "bundle_all" && !selectedBankIds) return { kind: "all" };
  if (productId === "bundle_custom") {
    try {
      const slugs = validateCustomBankIds(JSON.parse(selectedBankIds ?? ""));
      const banks = getEntitlementBanks();
      return { kind: "selected", banks: slugs.map((slug) => ({
        slug, name: banks.find((bank) => bank.slug === slug)?.shortName ?? slug,
      })) };
    } catch {
      return { kind: "unknown" };
    }
  }
  if (!productId || selectedBankIds) return { kind: "unknown" };
  const entitlement = { productId: productId as ProductId, status: "active" as const, startsAt: "2000-01-01T00:00:00Z", expiresAt: null };
  const banks = getEntitlementBanks().filter((bank) => hasBankAccess(bank.slug, [entitlement]));
  return banks.length ? { kind: "selected", banks: banks.map(({ slug, shortName }) => ({ slug, name: shortName })) } : { kind: "unknown" };
}

type PriceTier = { up_to: number | "inf" | null; unit_amount: number | null; flat_amount: number | null };
type RecurringPrice = { billing_scheme: "per_unit" | "tiered"; unit_amount: number | null; tiers_mode?: "graduated" | "volume" | null; tiers?: PriceTier[] | null };

/** Subtotal before discounts, credits, and taxes. Unknown Stripe shapes stay unknown. */
export function recurringPriceSubtotal(price: RecurringPrice, quantity: number): number | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return null;
  if (price.billing_scheme === "per_unit") {
    const amount = price.unit_amount;
    return amount !== null && Number.isSafeInteger(amount) && amount >= 0 && Number.isSafeInteger(amount * quantity) ? amount * quantity : null;
  }
  if (price.billing_scheme !== "tiered" || !Array.isArray(price.tiers) || !price.tiers.length) return null;
  if (price.tiers_mode !== "graduated" && price.tiers_mode !== "volume") return null;
  let lower = 0;
  let total = 0;
  for (const tier of price.tiers) {
    const upper = tier.up_to === "inf" || tier.up_to === null ? Infinity : tier.up_to;
    if ((!Number.isSafeInteger(upper) && upper !== Infinity) || upper <= lower || !Number.isSafeInteger(tier.unit_amount) || (tier.unit_amount ?? -1) < 0 || !Number.isSafeInteger(tier.flat_amount ?? 0) || (tier.flat_amount ?? 0) < 0) return null;
    if (price.tiers_mode === "volume") {
      if (quantity <= upper) {
        const result = quantity * tier.unit_amount! + (tier.flat_amount ?? 0);
        return Number.isSafeInteger(result) ? result : null;
      }
    } else {
      const tierUnits = Math.min(quantity, upper) - lower;
      if (tierUnits > 0) total += tierUnits * tier.unit_amount! + (tier.flat_amount ?? 0);
      if (quantity <= upper) return Number.isSafeInteger(total) ? total : null;
    }
    lower = upper;
  }
  return null;
}
