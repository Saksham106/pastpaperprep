import { getBillingBanks, type BankSlug } from "@/lib/banks";
import { BANK_CATALOG } from "@/lib/catalog";
import { PRICING_MODEL, priceForBankCount, type BillingInterval } from "@/lib/pricing-model";
import type { StripeConfig } from "@/lib/stripe-config";

export const CUSTOM_BUNDLE_PRODUCT_ID = "bundle_custom" as const;
export const MAX_CUSTOM_BANKS = PRICING_MODEL.builder.maxBanks;

const ALL_CANONICAL_BANK_IDS: readonly BankSlug[] = BANK_CATALOG.map(({ slug }) => slug);
const CANONICAL_BANK_SET = new Set<string>(ALL_CANONICAL_BANK_IDS);

function assertArray(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error("Bank selection must be an array"); return value; }
function validateKnownAndUnique(value: unknown): BankSlug[] {
  const selected = assertArray(value); const seen = new Set<string>();
  for (const bankId of selected) { if (typeof bankId !== "string" || !CANONICAL_BANK_SET.has(bankId)) throw new Error("Unknown bank"); if (seen.has(bankId)) throw new Error("Duplicate bank"); seen.add(bankId); }
  return selected as BankSlug[];
}
export function validateCustomBankIds(value: unknown, allowedBankIds?: readonly BankSlug[]): BankSlug[] {
  const selected = validateKnownAndUnique(value);
  if (allowedBankIds && selected.some((bankId) => !allowedBankIds.includes(bankId))) throw new Error("Bank is not available for checkout");
  if (selected.length === 0) throw new Error("Select at least one bank");
  if (selected.length > MAX_CUSTOM_BANKS) throw new Error("Select no more than five banks");
  return [...selected].sort();
}
export function getGraduatedBundlePrice(interval: BillingInterval, quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_CUSTOM_BANKS) throw new Error("Custom bundle quantity must be between one and five");
  return priceForBankCount(interval, quantity);
}
export type CustomBundlePlan = { interval: BillingInterval; productId: typeof CUSTOM_BUNDLE_PRODUCT_ID | "bundle_all"; priceId: string; quantity: number; selectedBankIds?: BankSlug[] };
export function getCustomBundlePlan(interval: BillingInterval, value: unknown, config: Pick<StripeConfig, "customMonthlyPriceId" | "customAnnualPriceId" | "allMonthlyPriceId" | "allAnnualPriceId">, environment: Record<string, string | undefined> = process.env): CustomBundlePlan {
  const selected = validateKnownAndUnique(value); const billingBankIds = getBillingBanks(environment).map(({ slug }) => slug);
  if (selected.some((bankId) => !billingBankIds.includes(bankId))) throw new Error("Bank is not available for checkout");
  if (selected.length < 2) throw new Error("Select at least two banks");
  if (selected.length > MAX_CUSTOM_BANKS) return { interval, productId: "bundle_all", priceId: interval === "monthly" ? config.allMonthlyPriceId : config.allAnnualPriceId, quantity: 1 };
  const selectedBankIds = validateCustomBankIds(selected);
  return { interval, productId: CUSTOM_BUNDLE_PRODUCT_ID, priceId: interval === "monthly" ? config.customMonthlyPriceId : config.customAnnualPriceId, quantity: selectedBankIds.length, selectedBankIds };
}
