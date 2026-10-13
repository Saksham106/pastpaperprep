import { isPreviewQuestion } from "@/lib/access";
import { ASSET_KINDS, assetPathsForKind, type AssetKind } from "@/lib/asset-kinds";
import type { AssetManifest } from "@/lib/asset-manifest";
import type { BankSlug } from "@/lib/banks";
import { explanationAssetSignOptions, previewAssetSignOptions } from "@/lib/private-asset-providers";
import { FREE_ASSET_INDEX_VERSION, freePublicAssetUrl, type FreeAssetIndex } from "@/lib/free-asset-index";
import type { QuestionRichDetails } from "@/lib/questions";
import { reviewedBlankTailForSignedAsset } from "@/lib/reviewed-blank-tails";

/**
 * Free-year files are copied, unchanged, into the public `pastpaperprep-free` R2 bucket under
 * `images/<private path>` (scripts/copy-free-public-assets.sh) and served from
 * free.pastpaperprep.com. A static per-bank index built with the site points at them, so a
 * visitor opening a free question never wakes a Vercel function. Only questions
 * `isPreviewQuestion` allows may ever appear in the list or the index.
 */
export type FreePublicAsset = { bank: BankSlug; questionId: string; kind: AssetKind; source: "r2" | "supabase"; path: string };

function sourceFor(bank: BankSlug, kind: AssetKind): "r2" | "supabase" {
  const options = kind === "explanation" ? explanationAssetSignOptions() : previewAssetSignOptions(bank);
  return options.provider === "r2" ? "r2" : "supabase";
}

/** A private object path that is safe to publish as `images/<path>`: plain segments, an image or explanation. */
const SAFE_ASSET_PATH = /^[a-z0-9][a-z0-9-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)+\.(?:webp|json)$/;
export function isSafeFreeAssetPath(path: string): boolean {
  return SAFE_ASSET_PATH.test(path) && !path.split("/").some((segment) => segment === "." || segment === ".." || segment.includes(".."));
}

/** Every free-year file for one bank, with the private store it is copied from. */
export function listFreePublicAssets(bank: BankSlug, manifest: AssetManifest): FreePublicAsset[] {
  const assets: FreePublicAsset[] = [];
  for (const [questionId, entry] of manifest) {
    if (!isPreviewQuestion(bank, questionId)) continue;
    for (const kind of ASSET_KINDS) {
      for (const path of assetPathsForKind(entry, kind)) {
        if (!isSafeFreeAssetPath(path)) throw new Error(`${bank}: unsafe asset path for ${questionId}`);
        assets.push({ bank, questionId, kind, source: sourceFor(bank, kind), path });
      }
    }
  }
  return assets;
}

/**
 * The same payload /api/assets/free returns for each free question, with public links instead of
 * signed ones. `details` must already be the free-visitor projection (richDetailsFor with no
 * entitlements); the caller passes it in so this module stays free of the question loader.
 */
export function buildFreeAssetIndex(
  bank: BankSlug,
  manifest: AssetManifest,
  freeDetails: (questionId: string, details: QuestionRichDetails) => QuestionRichDetails,
): FreeAssetIndex {
  const questions: FreeAssetIndex["questions"] = {};
  for (const [questionId, entry] of manifest) {
    if (!isPreviewQuestion(bank, questionId)) continue;
    const question: FreeAssetIndex["questions"][string] = { details: freeDetails(questionId, entry.details) };
    for (const kind of ASSET_KINDS) {
      const paths = assetPathsForKind(entry, kind);
      if (!paths.length) continue;
      question[kind] = {
        urls: paths.map(freePublicAssetUrl),
        displayCrops: paths.map((path) => reviewedBlankTailForSignedAsset(bank, questionId, kind, path)),
      };
    }
    questions[questionId] = question;
  }
  return { version: FREE_ASSET_INDEX_VERSION, bank, questions };
}
