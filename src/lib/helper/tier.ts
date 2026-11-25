import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { getEntitlementBanks } from "@/lib/banks";
import type { HelperTier } from "@/lib/helper/credits";

/**
 * Pepper's plan tier from the account's current entitlements, worked out on the server. All Access, Lifetime and
 * complimentary All Access open every bank; anything else counts the distinct banks it opens, across subscriptions
 * (a grandfathered subject pair counts as 2). Trialing counts as paid, as it does for bank access.
 */
export function helperTier(entitlements: readonly AccessEntitlement[], now = new Date(), banks: readonly { slug: string }[] = getEntitlementBanks()): HelperTier {
  const open = banks.filter((bank) => hasBankAccess(bank.slug as never, entitlements, now)).length;
  if (open === 0) return "free";
  if (open === banks.length) return "all";
  if (open >= 4) return "bank4";
  return (["bank1", "bank2", "bank3"] as const)[open - 1];
}
