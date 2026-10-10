import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BankSlug } from "@/lib/banks";
import { bankRuntimeCacheKey, loadBankQuestions } from "@/lib/question-loader";
import type { QuestionRichDetails, UnifiedQuestion } from "@/lib/questions";

export type AssetManifestEntry = { questionAssetPaths: string[]; markschemeAssetPaths: string[]; details: QuestionRichDetails };

export const ASSET_MANIFEST_DIRECTORY = join(process.cwd(), "generated", "asset-manifest");

export function buildBankAssetManifest(questions: readonly UnifiedQuestion[]): Record<string, AssetManifestEntry> {
  const manifest: Record<string, AssetManifestEntry> = {};
  for (const question of questions) {
    manifest[question.id] = {
      questionAssetPaths: question.questionAssetPaths,
      markschemeAssetPaths: question.markschemeAssetPaths,
      details: {
        summary: question.summary,
        accessibleText: question.accessibleText,
        solution: question.solution,
        sourceQuestionUrl: question.sourceQuestionUrl,
        sourceMarkSchemeUrl: question.sourceMarkSchemeUrl,
      },
    };
  }
  return manifest;
}

/** The runtime mode is part of the name, so a flag flip never reads a manifest built for the other mode. */
export function assetManifestFileName(slug: BankSlug): string {
  return `${bankRuntimeCacheKey(slug).replace(":", ".")}.json`;
}

const cache = new Map<string, Promise<ReadonlyMap<string, AssetManifestEntry>>>();

async function readGenerated(directory: string, slug: BankSlug) {
  try {
    return JSON.parse(await readFile(join(directory, assetManifestFileName(slug)), "utf8")) as Record<string, AssetManifestEntry>;
  } catch {
    return null;
  }
}

/**
 * Asset paths and rich details for one bank, without normalizing the whole corpus.
 * Production reads the prebuild output; everywhere else (and when that file is missing)
 * it derives the same data from the full loader.
 */
export function loadBankAssetManifest(
  slug: BankSlug,
  { directory = ASSET_MANIFEST_DIRECTORY, useGenerated = process.env.NODE_ENV === "production" }: { directory?: string; useGenerated?: boolean } = {},
): Promise<ReadonlyMap<string, AssetManifestEntry>> {
  const key = `${directory}:${useGenerated}:${bankRuntimeCacheKey(slug)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const loaded = (async () => {
    const generated = useGenerated ? await readGenerated(directory, slug) : null;
    const record = generated ?? buildBankAssetManifest(await loadBankQuestions(slug));
    return new Map(Object.entries(record));
  })();
  cache.set(key, loaded);
  void loaded.catch(() => { if (cache.get(key) === loaded) cache.delete(key); });
  return loaded;
}
