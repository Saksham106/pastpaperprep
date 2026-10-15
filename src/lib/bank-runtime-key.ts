import { isEconomicsMay2026Enabled, isEconomicsProductionEnabled, isIGCSEReleaseBank, isIGCSEReleaseEnabled, isLocalEconomicsBank, type BankSlug } from "@/lib/banks";

/** Which runtime artifact a bank serves in this environment (gated banks switch to "production"). */
export function bankRuntimeCacheKey(slug: BankSlug): string {
  const productionEconomics = isLocalEconomicsBank(slug) && isEconomicsProductionEnabled();
  const productionIGCSE = isIGCSEReleaseBank(slug) && isIGCSEReleaseEnabled();
  const may2026 = productionEconomics && isEconomicsMay2026Enabled() ? "+may2026" : "";
  return `${slug}:${productionEconomics || productionIGCSE ? "production" : "preview"}${may2026}`;
}
