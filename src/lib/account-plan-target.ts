import { BANK_PRODUCTS } from "@/lib/access";
import { getBillingBanks, type BankSlug } from "@/lib/banks";
import { CUSTOM_BUNDLE_PRODUCT_ID, MAX_CUSTOM_BANKS, validateCustomBankIds } from "@/lib/custom-bundles";
import type { BillingInterval, StripeConfig } from "@/lib/stripe-config";

export type AccountPlanTargetInput = { selectedBankIds: unknown; allAccess: unknown; interval: unknown };
export type AccountPlanTarget = {
  productId: string;
  priceId: string;
  quantity: number;
  selectedBankIds?: BankSlug[];
  interval: BillingInterval;
};
type Environment = Record<string, string | undefined>;
type AccountSubscriptionItem = {
  id?: unknown;
  quantity?: unknown;
  price?: { id?: unknown; recurring?: { interval?: unknown } | null } | string | null;
};
export type AccountPlanSubscription = {
  status?: unknown;
  items?: { data?: AccountSubscriptionItem[] } | null;
  metadata?: Record<string, string | undefined> | null;
  schedule?: unknown;
  pending_update?: unknown;
  cancel_at_period_end?: unknown;
  cancel_at?: unknown;
};
export type EditableCurrentPlan = AccountPlanTarget;

function intervalValue(value: unknown): BillingInterval {
  if (value !== "monthly" && value !== "annual") throw new Error("Unsupported billing interval");
  return value;
}
function priceFor(interval: BillingInterval, monthly: string, annual: string) {
  return interval === "monthly" ? monthly : annual;
}

export function resolveAccountPlanTarget(input: AccountPlanTargetInput, config: StripeConfig, environment: Environment = process.env): AccountPlanTarget {
  if (!input || typeof input !== "object" || !Array.isArray(input.selectedBankIds) || typeof input.allAccess !== "boolean") throw new Error("Invalid plan selection");
  const interval = intervalValue(input.interval);
  const billingIds = new Set(getBillingBanks(environment).map(({ slug }) => slug));
  const selected: BankSlug[] = [];
  const seen = new Set<string>();
  for (const value of input.selectedBankIds) {
    if (typeof value !== "string" || !(value in BANK_PRODUCTS)) throw new Error("Unknown bank");
    if (seen.has(value)) throw new Error("Duplicate bank");
    if (!billingIds.has(value as BankSlug)) throw new Error("Bank is unavailable");
    seen.add(value);
    selected.push(value as BankSlug);
  }
  if (input.allAccess && selected.length) throw new Error("All Access conflicts with selected banks");
  if (input.allAccess || selected.length > MAX_CUSTOM_BANKS) return {
    productId: "bundle_all", priceId: priceFor(interval, config.allMonthlyPriceId, config.allAnnualPriceId), quantity: 1, interval,
  };
  if (selected.length === 0) throw new Error("Select at least one bank");
  const canonical = [...selected].sort();
  if (canonical.length === 1) {
    const productId = BANK_PRODUCTS[canonical[0]];
    if (!productId) throw new Error("Bank has no fixed product");
    return { productId, priceId: priceFor(interval, config.singleMonthlyPriceId, config.singleAnnualPriceId), quantity: 1, selectedBankIds: canonical, interval };
  }
  return { productId: CUSTOM_BUNDLE_PRODUCT_ID, priceId: priceFor(interval, config.customMonthlyPriceId, config.customAnnualPriceId), quantity: canonical.length, selectedBankIds: canonical, interval };
}

export function readEditableCurrentPlan(subscription: AccountPlanSubscription, config: StripeConfig, environment: Environment = process.env): EditableCurrentPlan {
  if (!subscription || typeof subscription !== "object" || subscription.status !== "active" || subscription.schedule != null || subscription.pending_update != null || subscription.cancel_at_period_end !== false || subscription.cancel_at != null) throw new Error("Subscription is not editable");
  const items = subscription.items?.data;
  if (!Array.isArray(items) || items.length !== 1) throw new Error("Expected exactly one subscription item");
  const item = items[0];
  if (!Number.isSafeInteger(item.quantity) || (item.quantity as number) < 1) throw new Error("Invalid subscription quantity");
  const price = typeof item.price === "string" ? item.price : item.price?.id;
  const recurringInterval = typeof item.price === "object" && item.price ? item.price.recurring?.interval : undefined;
  const interval: BillingInterval = recurringInterval === "month" ? "monthly" : recurringInterval === "year" ? "annual" : (() => { throw new Error("Unsupported Stripe interval"); })();
  const metadata = subscription.metadata;
  if (!metadata || typeof metadata.product_id !== "string") throw new Error("Missing subscription product metadata");
  if ((metadata.billing_interval && metadata.billing_interval !== interval) || (metadata.price_id && metadata.price_id !== price)) throw new Error("Inconsistent subscription metadata");
  if (metadata.product_id === CUSTOM_BUNDLE_PRODUCT_ID && (metadata.billing_interval !== interval || metadata.price_id !== price)) throw new Error("Missing custom bundle metadata");
  const selectedMetadata = metadata.selected_bank_ids;
  let result: AccountPlanTarget;
  if (metadata.product_id === "bundle_all") {
    if (selectedMetadata != null && selectedMetadata !== "") throw new Error("Unexpected All Access bank metadata");
    result = { productId: "bundle_all", priceId: priceFor(interval, config.allMonthlyPriceId, config.allAnnualPriceId), quantity: 1, interval };
  } else if (metadata.product_id === CUSTOM_BUNDLE_PRODUCT_ID) {
    if (typeof selectedMetadata !== "string") throw new Error("Missing selected bank metadata");
    let selected: unknown;
    try { selected = JSON.parse(selectedMetadata); } catch { throw new Error("Invalid selected bank metadata"); }
    const canonical = validateCustomBankIds(selected);
    if (canonical.length < 2 || canonical.length > MAX_CUSTOM_BANKS || canonical.length !== item.quantity) throw new Error("Invalid custom bundle selection");
    const available = new Set(getBillingBanks(environment).map(({ slug }) => slug));
    if (canonical.some((id) => !available.has(id))) throw new Error("Bank is unavailable");
    result = { productId: CUSTOM_BUNDLE_PRODUCT_ID, priceId: priceFor(interval, config.customMonthlyPriceId, config.customAnnualPriceId), quantity: canonical.length, selectedBankIds: canonical, interval };
  } else {
    if (selectedMetadata != null && selectedMetadata !== "") throw new Error("Unexpected fixed bank selection");
    if (item.quantity !== 1) throw new Error("Invalid fixed bank quantity");
    const matching = getBillingBanks(environment).map(({ slug }) => slug).filter((slug) => BANK_PRODUCTS[slug] === metadata.product_id);
    if (matching.length !== 1) throw new Error("Fixed product does not identify exactly one available bank");
    result = { productId: metadata.product_id, priceId: priceFor(interval, config.singleMonthlyPriceId, config.singleAnnualPriceId), quantity: 1, selectedBankIds: matching, interval };
  }
  if (typeof price !== "string" || !price || result.priceId !== price) throw new Error("Subscription price is not currently editable");
  return result;
}
