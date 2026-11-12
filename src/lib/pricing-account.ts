import { hasBankAccess, type AccessEntitlement, type ProductId } from "@/lib/access";
import { hasComplimentaryAllAccess } from "@/lib/complimentary-access";
import type { Bank, BankSlug } from "@/lib/banks";

/** The signed-in plan state the pricing page shows. Display only: checkout re-checks on the server. */
export type PricingAccount = {
  authenticated: boolean;
  hasPaidAccess: boolean;
  ownedBankIds: BankSlug[];
  currentPlanNames: string[];
  currentPlanProductIds: ProductId[];
  complimentaryAccess: boolean;
  manualAccess: boolean;
};

export const SIGNED_OUT_PRICING_ACCOUNT: PricingAccount = {
  authenticated: false, hasPaidAccess: false, ownedBankIds: [], currentPlanNames: [], currentPlanProductIds: [], complimentaryAccess: false, manualAccess: false,
};

export type PricingEntitlementRow = AccessEntitlement & { source?: string; products?: { name?: string } | { name?: string }[] | null };

export function resolvePricingAccount(entitlements: readonly PricingEntitlementRow[], billingBanks: readonly Bank[], entitlementBanks: readonly Bank[]): PricingAccount {
  const ownedBankIds = billingBanks.filter(({ slug }) => hasBankAccess(slug, entitlements)).map(({ slug }) => slug);
  const hasPaidAccess = entitlementBanks.some(({ slug }) => hasBankAccess(slug, entitlements));
  const currentEntitlements = entitlements.filter((row) => billingBanks.some(({ slug }) => hasBankAccess(slug, [row])));
  const manualAccess = currentEntitlements.some((row) => row.source === "manual");
  const activeStripeAccess = currentEntitlements.some((row) => row.source === "stripe");
  // A manual All Access grant remains complimentary when stale/expired Stripe rows
  // are present, but a separately active Stripe entitlement remains billable.
  const complimentaryAccess = hasPaidAccess && hasComplimentaryAllAccess(entitlements) && !activeStripeAccess;
  const currentPlanNames = Array.from(new Set(currentEntitlements.flatMap((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    return product?.name ? [product.name] : [];
  })));
  return {
    authenticated: true,
    hasPaidAccess,
    ownedBankIds,
    currentPlanNames,
    currentPlanProductIds: currentEntitlements.map(({ productId }) => productId),
    complimentaryAccess,
    manualAccess: !activeStripeAccess && manualAccess,
  };
}

const PRODUCT_ID = /^[a-z0-9_]{1,64}$/;
const BANK_ID = /^[a-z0-9-]{1,64}$/;

/** Validates the account API's JSON before the page trusts it for display. */
export function parsePricingAccount(value: unknown): PricingAccount | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const strings = (input: unknown, pattern?: RegExp) => Array.isArray(input) && input.every((item) => typeof item === "string" && (!pattern || pattern.test(item))) ? input as string[] : null;
  const ownedBankIds = strings(body.ownedBankIds, BANK_ID);
  const currentPlanNames = strings(body.currentPlanNames);
  const currentPlanProductIds = strings(body.currentPlanProductIds, PRODUCT_ID);
  const flags = [body.authenticated, body.hasPaidAccess, body.complimentaryAccess, body.manualAccess];
  if (!ownedBankIds || !currentPlanNames || !currentPlanProductIds || flags.some((flag) => typeof flag !== "boolean")) return null;
  return {
    authenticated: body.authenticated as boolean,
    hasPaidAccess: body.hasPaidAccess as boolean,
    ownedBankIds: ownedBankIds as BankSlug[],
    currentPlanNames,
    currentPlanProductIds: currentPlanProductIds as ProductId[],
    complimentaryAccess: body.complimentaryAccess as boolean,
    manualAccess: body.manualAccess as boolean,
  };
}
