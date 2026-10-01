import approved from "@/data/reviewed-blank-tails-0606.json";
import type { BankSlug } from "@/lib/banks";

export type VisibleImageCrop = {
  imageSha256: string;
  fullWidthPx: number;
  fullHeightPx: number;
  visibleHeightPx: number;
};

type ReviewedTail = {
  imageSha256: string;
  path: string;
  rasterSizePx: [number, number];
  visibleHeightPx: number;
  blankSourcePage: number;
};

/** Only 19 hash-pinned, source/visually-reviewed 0606 final BLANK PAGE segments. */
export function reviewedBlankTailForSignedAsset(
  bank: BankSlug, questionId: string, kind: "question" | "answer", path: string,
): VisibleImageCrop | null {
  if (bank !== "igcse-additional" || kind !== "question") return null;
  const item = (approved.entries as unknown as Record<string, ReviewedTail>)[questionId];
  if (!item || (path !== item.path && !path.endsWith(`/${item.path}`))) return null;
  const [fullWidthPx, fullHeightPx] = item.rasterSizePx;
  if (!Number.isSafeInteger(item.visibleHeightPx) || item.visibleHeightPx <= 0 ||
    item.visibleHeightPx >= fullHeightPx) return null;
  return { imageSha256: item.imageSha256, fullWidthPx, fullHeightPx, visibleHeightPx: item.visibleHeightPx };
}

export function reviewedBlankTailHash(bank: BankSlug, questionId: string, kind: "question" | "answer", path: string): string | null {
  return reviewedBlankTailForSignedAsset(bank, questionId, kind, path)?.imageSha256 ?? null;
}

export function matchesReviewedDisplayCrop(bank: BankSlug, questionId: string, crop: VisibleImageCrop): boolean {
  if (bank !== "igcse-additional") return false;
  const item = (approved.entries as unknown as Record<string, ReviewedTail>)[questionId];
  return Boolean(item && item.path === `questions/${questionId}.webp` &&
    crop.imageSha256 === item.imageSha256 &&
    crop.fullWidthPx === item.rasterSizePx[0] &&
    crop.fullHeightPx === item.rasterSizePx[1] &&
    crop.visibleHeightPx === item.visibleHeightPx);
}

export function reviewedBlankSourcePage(questionId: string): number | null {
  const item = (approved.entries as unknown as Record<string, ReviewedTail>)[questionId];
  return item?.blankSourcePage ?? null;
}
