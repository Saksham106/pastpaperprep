#!/usr/bin/env tsx
// Prints every free-year asset as `source<TAB>path`, for copying into the public free bucket
// (scripts/copy-free-public-assets.sh). Run with the production release flags set, after
// `npm run generate:asset-manifest`.
import { getAvailableBanks } from "@/lib/banks";
import { loadBankAssetManifest } from "@/lib/asset-manifest";
import { listFreePublicAssets } from "@/lib/free-public-assets";

const seen = new Set<string>();
for (const bank of getAvailableBanks()) {
  const manifest = await loadBankAssetManifest(bank.slug);
  for (const asset of listFreePublicAssets(bank.slug, manifest)) {
    if (seen.has(asset.path)) continue;
    seen.add(asset.path);
    console.log(`${asset.source}\t${asset.path}`);
  }
}
