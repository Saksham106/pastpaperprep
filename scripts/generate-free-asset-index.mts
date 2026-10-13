#!/usr/bin/env tsx
// Prebuild, after generate:asset-manifest: one static public/free-assets/<bank>.json per bank
// listing its free-year questions with links into the public free bucket (see
// src/lib/free-public-assets.ts). Static files are served by the CDN, so free questions cost no
// function time. Fails the build if an enabled bank has no manifest or anything outside the free
// years would be listed.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isPreviewQuestion } from "@/lib/access";
import { loadBankAssetManifest } from "@/lib/asset-manifest";
import { getAvailableBanks } from "@/lib/banks";
import { freeAssetIndexPath } from "@/lib/free-asset-index";
import { buildFreeAssetIndex } from "@/lib/free-public-assets";
import { richDetailsFor } from "@/lib/question-delivery";

const root = join(process.cwd(), "public");
await rm(join(root, "free-assets"), { recursive: true, force: true });
await mkdir(join(root, "free-assets"), { recursive: true });

for (const bank of getAvailableBanks()) {
  // Every enabled bank gets an index: a missing one would quietly send its free questions back to
  // the signing route, so a missing or unreadable manifest fails the build instead.
  const manifest = await loadBankAssetManifest(bank.slug).catch((error: unknown) => {
    throw new Error(`${bank.slug}: asset manifest missing or invalid; run generate:asset-manifest first`, { cause: error });
  });
  if (!manifest.size) throw new Error(`${bank.slug}: asset manifest is empty`);
  const index = buildFreeAssetIndex(bank.slug, manifest, (questionId, details) => richDetailsFor(bank.slug, questionId, details, []));
  const leaked = Object.keys(index.questions).filter((questionId) => !isPreviewQuestion(bank.slug, questionId));
  if (leaked.length) throw new Error(`${bank.slug}: free asset index lists paid questions (${leaked.slice(0, 3).join(", ")})`);
  await writeFile(join(root, freeAssetIndexPath(bank.slug)), JSON.stringify(index));
  console.log(`${bank.slug}: ${Object.keys(index.questions).length} free questions -> ${freeAssetIndexPath(bank.slug)}`);
}
