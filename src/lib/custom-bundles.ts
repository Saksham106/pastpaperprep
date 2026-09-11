import { BANKS, getBillingBanks, type BankSlug } from "@/lib/banks";
import type { BillingInterval, StripeConfig } from "@/lib/stripe-config";

export const CUSTOM_BUNDLE_PRODUCT_ID = "bundle_custom" as const;
export const MAX_CUSTOM_BANKS = 5;

const CANONICAL_BANK_IDS: readonly BankSlug[] = BANKS.map(({ slug }) => slug);
const ALL_CANONICAL_BANK_IDS: readonly BankSlug[] = [
  ...CANONICAL_BANK_IDS,
  "ib-economics-hl",
  "ib-economics-sl",
];
const CANONICAL_BANK_SET = new Set<string>(ALL_CANONICAL_BANK_IDS);

function assertArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Bank selection must be an array");
  return value;
}

function validateKnownAndUnique(value: unknown): BankSlug[] {
  const selected = assertArray(value);
  const seen = new Set<string>();
  for (const bankId of selected) {
    if (typeof bankId !== "string" || !CANONICAL_BANK_SET.has(bankId)) {
      throw new Error("Unknown bank");
    }
    if (seen.has(bankId)) throw new Error("Duplicate bank");
    seen.add(bankId);
  }
  return selected as BankSlug[];
}

/** Validate a new custom bundle, which may contain one through five banks. */
export function validateCustomBankIds(value: unknown, allowedBankIds?: readonly BankSlug[]): BankSlug[] {
  const selected = validateKnownAndUnique(value);
  if (allowedBankIds && selected.some((bankId) => !allowedBankIds.includes(bankId))) {
    throw new Error("Bank is not available for checkout");
  }
  if (selected.length === 0) throw new Error("Select at least one bank");
  if (selected.length > MAX_CUSTOM_BANKS) throw new Error("Select no more than five banks");
  return [...selected].sort();
}

export function getGraduatedBundlePrice(interval: BillingInterval, quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_CUSTOM_BANKS) {
    throw new Error("Custom bundle quantity must be between one and five");
  }
  const monthlyEquivalentCents = interval === "monthly"
    ? 600 + (quantity - 1) * 400
    : 4800 + (quantity - 1) * 3600;
  return monthlyEquivalentCents;
}

export type CustomBundlePlan = {
  interval: BillingInterval;
  productId: typeof CUSTOM_BUNDLE_PRODUCT_ID | "bundle_all";
  priceId: string;
  quantity: number;
  selectedBankIds?: BankSlug[];
};

/** Resolve the complete Stripe line item from trusted server configuration. */
export function getCustomBundlePlan(
  interval: BillingInterval,
  value: unknown,
  config: Pick<StripeConfig, "customMonthlyPriceId" | "customAnnualPriceId" | "allMonthlyPriceId" | "allAnnualPriceId">,
  environment: Record<string, string | undefined> = process.env,
): CustomBundlePlan {
  const selected = validateKnownAndUnique(value);
  const billingBankIds = getBillingBanks(environment).map(({ slug }) => slug);
  if (selected.some((bankId) => !billingBankIds.includes(bankId))) {
    throw new Error("Bank is not available for checkout");
  }
  if (selected.length === 0) throw new Error("Select at least one bank");
  if (selected.length > MAX_CUSTOM_BANKS) {
    return {
      interval,
      productId: "bundle_all",
      priceId: interval === "monthly" ? config.allMonthlyPriceId : config.allAnnualPriceId,
      quantity: 1,
    };
  }
  const selectedBankIds = validateCustomBankIds(selected);
  return {
    interval,
    productId: CUSTOM_BUNDLE_PRODUCT_ID,
    priceId: interval === "monthly" ? config.customMonthlyPriceId : config.customAnnualPriceId,
    quantity: selectedBankIds.length,
    selectedBankIds,
  };
}
