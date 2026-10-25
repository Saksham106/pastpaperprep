import type { BankSlug } from "@/lib/banks";

// Provider choice only (no SDK, no secrets), so pages can derive preconnect hints from it.
export type AssetStorageProvider = "supabase" | "r2";

export type SignPrivateAssetOptions = {
  provider?: AssetStorageProvider;
  /** Free-year links only: allows up to a week instead of an hour. Never for paid assets. */
  longLived?: boolean;
};

/**
 * The release banks whose private objects live in R2. Provider selection is pinned
 * for previews and paid delivery alike: a preview must use the store verified by
 * its release receipt, never assume a retained Supabase copy exists.
 */
const R2_PRIVATE_BANKS: ReadonlySet<string> = new Set<BankSlug>([
  "igcse-biology-0610",
  "igcse-economics-0455",
  "igcse-chemistry-0620",
  "igcse-physics-0625",
  "igcse-coordinated-sciences-0654",
  "igcse-computer-science-0478",
  "ib-computer-science-hl",
  "ib-computer-science-sl",
  "ib-economics-hl",
  "ib-economics-sl",
]);

/**
 * Published banks whose free years also sign from R2. Their free set grew past what Supabase
 * retains, and R2 already holds every object these banks serve, so Supabase keeps none of them.
 */
const R2_PREVIEW_BANKS: ReadonlySet<string> = new Set<BankSlug>([
  "ib-chemistry-hl",
  "ib-chemistry-sl",
  "ib-physics-hl",
  "ib-physics-sl",
  "ib-biology-hl",
  "ib-biology-sl",
]);

/** Preview assets: R2 for the R2-backed banks, Supabase for everything else. */
export function previewAssetSignOptions(bank: BankSlug): SignPrivateAssetOptions {
  return R2_PRIVATE_BANKS.has(bank) || R2_PREVIEW_BANKS.has(bank) ? { provider: "r2" } : { provider: "supabase" };
}

/** Premium assets keep the configured default, pinned to R2 for the R2-backed private banks. */
export function premiumAssetSignOptions(bank: BankSlug): SignPrivateAssetOptions {
  return R2_PRIVATE_BANKS.has(bank) ? { provider: "r2" } : {};
}

/**
 * Objects uploaded to R2 only, inside banks that otherwise sign from Supabase: the IB
 * shared-stimulus repair crops (docs/ib-shared-stimulus-repairs.md). They always sign from R2.
 */
const R2_ONLY_OBJECT_PATH = /^ib-(?:biology|chemistry|physics)-(?:hl|sl)\/repairs\/ib-shared-stimulus-v1-d53ab265e7e81518\//;

export function isR2OnlyObjectPath(path: string): boolean {
  return R2_ONLY_OBJECT_PATH.test(path);
}

/** Worked explanations live only in R2 (`explanations/<bank>/`), for free and paid questions alike. */
export function explanationAssetSignOptions(): SignPrivateAssetOptions {
  return { provider: "r2" };
}
