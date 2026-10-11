import type { BankSlug } from "@/lib/banks";

// Provider choice only (no SDK, no secrets), so pages can derive preconnect hints from it.
export type AssetStorageProvider = "supabase" | "r2";

export type SignPrivateAssetOptions = {
  provider?: AssetStorageProvider;
  /** Free-year links only: allows up to a day instead of an hour. Never for paid assets. */
  longLived?: boolean;
};

/**
 * The banks whose private objects live in R2, i.e. the banks whose release tooling
 * (scripts/igcse-release.mjs) uploads to the R2 bucket. A preview asset must be signed by
 * the provider that actually holds it: signing IGcse release previews from Supabase was
 * the second root cause of the empty free funnel (the object exists only in R2, so every
 * free question image 404'd while the bank still advertised `?free=1`).
 */
const R2_PRIVATE_BANKS: ReadonlySet<string> = new Set<BankSlug>([
  "igcse-biology-0610",
  "igcse-economics-0455",
  "igcse-chemistry-0620",
  "igcse-physics-0625",
  "igcse-coordinated-sciences-0654",
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
