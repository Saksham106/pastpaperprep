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
  "ib-economics-hl",
  "ib-economics-sl",
]);

/** Preview assets: R2 for the R2-backed private banks, Supabase for everything else. */
export function previewAssetSignOptions(bank: BankSlug): SignPrivateAssetOptions {
  return R2_PRIVATE_BANKS.has(bank) ? { provider: "r2" } : { provider: "supabase" };
}

/** Premium assets keep the configured default, pinned to R2 for the R2-backed private banks. */
export function premiumAssetSignOptions(bank: BankSlug): SignPrivateAssetOptions {
  return R2_PRIVATE_BANKS.has(bank) ? { provider: "r2" } : {};
}

/** Worked explanations live only in R2 (`explanations/<bank>/`), for free and paid questions alike. */
export function explanationAssetSignOptions(): SignPrivateAssetOptions {
  return { provider: "r2" };
}
