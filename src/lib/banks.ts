import {
  BANK_CATALOG,
  catalogBankToRuntimeBank,
  getCatalogBanksForDisplay,
  getCatalogBank,
  getCatalogBillingBanks,
  isCatalogBankEnabled,
  isCatalogBankBillable,
  isCatalogLocalPreviewEnabled,
  type BankSlug,
  type CatalogBank,
} from "@/lib/catalog";

export type EconomicsBankSlug = "ib-economics-hl" | "ib-economics-sl";
export type IGCSEReleaseBankSlug = "igcse-biology-0610" | "igcse-economics-0455" | "igcse-chemistry-0620" | "igcse-physics-0625";
export type { BankSlug };
export type ProductionBankSlug = Exclude<BankSlug, EconomicsBankSlug | IGCSEReleaseBankSlug>;
export type LegacyProductionBankSlug = ProductionBankSlug;
export const ECONOMICS_PRODUCT_IDS = ["bank_ib_economics_hl", "bank_ib_economics_sl", "bundle_ib_economics"] as const;

export type Bank = {
  slug: BankSlug;
  shortName: string;
  title: string;
  description: string;
  qualification: string;
  subject: string;
  questionCount: number;
  paperCount: number;
  years: string;
  accent: "cobalt" | "coral" | "lime";
  sourceBaseUrl: string;
  localPreview?: boolean;
  productionEnabled?: boolean;
  releaseStatus?: string;
  rightsStatus?: string;
  entitlementProductId?: string | null;
};

const runtimeBanks = (entries: readonly CatalogBank[]) => entries.map(catalogBankToRuntimeBank);

/** Compatibility facade. Runtime identity and availability live in catalog.ts. */
export const BANKS: readonly Bank[] = runtimeBanks(BANK_CATALOG.filter((entry) => entry.release === "published"));
export const LOCAL_PREVIEW_BANKS: readonly Bank[] = runtimeBanks(BANK_CATALOG.filter((entry) => entry.delivery === "local-preview"));
export const ECONOMICS_BANK_CATALOG: readonly Bank[] = runtimeBanks(BANK_CATALOG.filter((entry) => entry.slug === "ib-economics-hl" || entry.slug === "ib-economics-sl"));
export const IGCSE_RELEASE_BANK_CATALOG: readonly Bank[] = runtimeBanks(BANK_CATALOG.filter((entry) =>
  entry.qualification === "Cambridge IGCSE" && entry.release === "gated",
));

const IGCSE_RELEASE_SLUGS = new Set<BankSlug>([
  "igcse-biology-0610",
  "igcse-economics-0455",
  "igcse-chemistry-0620",
  "igcse-physics-0625",
]);

export function isIGCSEReleaseBank(slug: string): slug is IGCSEReleaseBankSlug {
  return IGCSE_RELEASE_SLUGS.has(slug as BankSlug);
}
export function isIGCSEReleaseEnabled(environment: Record<string, string | undefined> = process.env) {
  return getCatalogBanksForDisplay(environment).some((entry) => isIGCSEReleaseBank(entry.slug));
}
export function isLocalEconomicsBank(slug: string): slug is EconomicsBankSlug {
  return slug === "ib-economics-hl" || slug === "ib-economics-sl";
}
export function isEconomicsProductionEnabled(environment: Record<string, string | undefined> = process.env) {
  const economics = getCatalogBank("ib-economics-hl");
  return Boolean(economics && isCatalogBankEnabled(economics, environment) && isCatalogBankBillable(economics, environment));
}
export function isLocalEconomicsPreviewEnabled(environment: Record<string, string | undefined> = process.env) {
  const economics = getCatalogBank("ib-economics-hl");
  return Boolean(economics && isCatalogLocalPreviewEnabled(economics, environment));
}
export function getEntitlementBanks(): readonly Bank[] { return runtimeBanks(BANK_CATALOG); }
export function getBillingBanks(environment: Record<string, string | undefined> = process.env): readonly Bank[] { return runtimeBanks(getCatalogBillingBanks(environment)); }
export function getAvailableBanks(environment: Record<string, string | undefined> = process.env): readonly Bank[] { return runtimeBanks(getCatalogBanksForDisplay(environment)); }
export function getBank(slug: string, environment: Record<string, string | undefined> = process.env): Bank | undefined {
  const entry = getCatalogBanksForDisplay(environment).find((candidate) => candidate.slug === slug);
  if (!entry) return undefined;
  const runtimeBank = catalogBankToRuntimeBank(entry);
  if (isLocalEconomicsBank(slug) && isCatalogBankBillable(entry, environment)) {
    runtimeBank.productionEnabled = true;
  }
  return runtimeBank;
}
