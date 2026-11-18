// Banks staged with `pendingStorage: true` in src/lib/catalog.ts: registered in code, hidden everywhere.
// Plain .mjs so the build scripts (bank-index generator, postbuild check) and the app share one list;
// held-banks.test.ts keeps it equal to the catalog. Switching a bank on removes it from both places.

/** @type {readonly string[]} */
export const HELD_BANKS = Object.freeze(["a-level-physics-9702", "a-level-chemistry-9701"]);

/** The dev-only preview that shows held banks locally. Never true for a production build. */
export function isPendingBankPreview(environment = process.env) {
  return environment.PASTPAPERPREP_PREVIEW_PENDING_BANKS === "true" && environment.NODE_ENV !== "production";
}

/**
 * The banks whose static metadata index may be published to public/bank-index: every bank except held ones,
 * unless the dev-only preview is on.
 * @template {string} T
 * @param {readonly T[]} banks
 * @param {Record<string, string | undefined>} [environment]
 * @param {readonly string[]} [held]
 * @returns {T[]}
 */
export function publishedIndexBanks(banks, environment = process.env, held = HELD_BANKS) {
  return isPendingBankPreview(environment) ? [...banks] : banks.filter((bank) => !held.includes(bank));
}
