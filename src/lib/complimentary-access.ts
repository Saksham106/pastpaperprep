import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { getEntitlementBanks } from "@/lib/banks";

/** A current manual All Access grant is not a Stripe subscription or a zero-dollar plan. */
export function hasComplimentaryAllAccess(rows: readonly (AccessEntitlement & { source?: unknown })[]): boolean {
  const bank = getEntitlementBanks()[0];
  return Boolean(bank && rows.some((row) => row.source === "manual" && row.productId === "bundle_all" && hasBankAccess(bank.slug, [row])));
}
