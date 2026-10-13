import type { AssetKind } from "@/lib/asset-kinds";
import type { BankSlug } from "@/lib/banks";
import type { QuestionRichDetails } from "@/lib/questions";
import type { VisibleImageCrop } from "@/lib/reviewed-blank-tails";

// Browser-safe half of src/lib/free-public-assets.ts: constants and the static index shape only.
export const FREE_PUBLIC_ASSET_ORIGIN = "https://free.pastpaperprep.com";
export const FREE_PUBLIC_ASSET_PREFIX = "images/";
export const FREE_ASSET_INDEX_VERSION = 1;

export type FreeAssetIndexEntry = { urls: string[]; displayCrops: Array<VisibleImageCrop | null> };
export type FreeAssetIndex = {
  version: typeof FREE_ASSET_INDEX_VERSION;
  bank: BankSlug;
  questions: Record<string, { details: QuestionRichDetails } & Partial<Record<AssetKind, FreeAssetIndexEntry>>>;
};

export function freePublicAssetUrl(path: string): string {
  return `${FREE_PUBLIC_ASSET_ORIGIN}/${FREE_PUBLIC_ASSET_PREFIX}${path}`;
}

export function isFreePublicAssetUrl(url: string | undefined): boolean {
  return Boolean(url?.startsWith(`${FREE_PUBLIC_ASSET_ORIGIN}/`));
}

export function freeAssetIndexPath(bank: BankSlug): string {
  return `/free-assets/${bank}.json`;
}
