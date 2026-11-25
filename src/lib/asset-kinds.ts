// Dependency-free so the signing routes can use it without bundling the question loader.
export type AssetKind = "question" | "answer" | "explanation";
export const ASSET_KINDS: readonly AssetKind[] = ["question", "answer", "explanation"];

export function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === "string" && (ASSET_KINDS as readonly string[]).includes(value);
}

type KindPaths = {
  questionAssetPaths: string[]; markschemeAssetPaths: string[]; explanationAssetPaths?: string[]; mcqAnswer?: unknown;
  /** [width, height] in pixels, aligned with the paths above; null where the size is unknown. */
  questionAssetSizes?: Array<[number, number] | null>; markschemeAssetSizes?: Array<[number, number] | null>;
};

/** Explanations are gated like the mark scheme: they reveal the answer. */
export function assetPathsForKind(entry: KindPaths, kind: AssetKind): string[] {
  if (kind === "question") return entry.questionAssetPaths;
  if (kind === "answer") return entry.markschemeAssetPaths;
  return entry.explanationAssetPaths ?? [];
}

/**
 * The files a reader is sent. A multiple-choice question with a verified letter answers with the
 * letter alone, so its mark-scheme crop is neither signed nor counted against an allowance.
 */
export function deliveredAssetPaths(entry: KindPaths, kind: AssetKind): string[] {
  return kind === "answer" && entry.mcqAnswer ? [] : assetPathsForKind(entry, kind);
}

/** Pixel sizes aligned with deliveredAssetPaths; null where unknown (explanations never have one). */
export function deliveredAssetSizes(entry: KindPaths, kind: AssetKind): Array<[number, number] | null> {
  const sizes = kind === "question" ? entry.questionAssetSizes : kind === "answer" ? entry.markschemeAssetSizes : undefined;
  return deliveredAssetPaths(entry, kind).map((_, index) => sizes?.[index] ?? null);
}

/** The `sizesPx` response field, left out when no size is known so old payloads stay the same. */
export function sizesPxField(sizes: Array<[number, number] | null>): { sizesPx?: Array<[number, number] | null> } {
  return sizes.some(Boolean) ? { sizesPx: sizes } : {};
}
