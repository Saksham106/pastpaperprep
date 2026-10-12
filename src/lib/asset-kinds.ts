// Dependency-free so the signing routes can use it without bundling the question loader.
export type AssetKind = "question" | "answer" | "explanation";
export const ASSET_KINDS: readonly AssetKind[] = ["question", "answer", "explanation"];

export function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === "string" && (ASSET_KINDS as readonly string[]).includes(value);
}

type KindPaths = { questionAssetPaths: string[]; markschemeAssetPaths: string[]; explanationAssetPaths?: string[] };

/** Explanations are gated like the mark scheme: they reveal the answer. */
export function assetPathsForKind(entry: KindPaths, kind: AssetKind): string[] {
  if (kind === "question") return entry.questionAssetPaths;
  if (kind === "answer") return entry.markschemeAssetPaths;
  return entry.explanationAssetPaths ?? [];
}
