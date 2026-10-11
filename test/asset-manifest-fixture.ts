import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assetManifestFileName } from "@/lib/asset-manifest";
import { buildBankAssetManifest } from "@/lib/asset-manifest-build";
import type { BankSlug } from "@/lib/banks";
import { loadBankQuestions } from "@/lib/question-loader";

/**
 * Tests that stub a production environment (e.g. IGCSE release banks enabled) need the manifest
 * prebuild would write under that environment; `npm run generate:asset-manifest` only covers the
 * local one.
 */
export async function ensureAssetManifestForCurrentEnvironment(slug: BankSlug): Promise<void> {
  const file = join(process.cwd(), "generated", "asset-manifest", assetManifestFileName(slug));
  if (existsSync(file)) return;
  await mkdir(join(process.cwd(), "generated", "asset-manifest"), { recursive: true });
  await writeFile(file, JSON.stringify(buildBankAssetManifest(await loadBankQuestions(slug))));
}
