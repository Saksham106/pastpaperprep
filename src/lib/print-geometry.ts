import verified0580 from "@/data/print-geometry-0580.json";
import verified0580Core2026 from "@/data/print-geometry-0580-2026-core.json";
import verified0580CoreCropRepairs from "@/data/print-geometry-0580-core-crop-repairs.json";
import verified0606 from "@/data/print-geometry-0606.json";
import verified0606March2026 from "@/data/print-geometry-0606-2026-march.json";
import type { BankSlug } from "@/lib/banks";
import { reviewedBlankTailForSignedAsset, reviewedBlankSourcePage } from "@/lib/reviewed-blank-tails";
import { reviewed0606RightEdgeGeometry } from "@/lib/reviewed-0606-ms-right-edge-repairs";
import { reviewed0606SplitGeometry } from "@/lib/reviewed-0606-question-splits";

export type PhysicalSizePt = readonly [number, number];
export type SourcePrintSegment = {
  imageSha256?: string;
  sourceY: number;
  sourceHeight: number;
  physicalHeightPt: number;
  sourcePage: number;
  include?: boolean;
};

/** [path, imageSha256, widthPx, heightPx, widthPt, heightPt, [sourceY, sourceHeight, physicalHeightPt, sourcePage, include][]] */
type Verified0580Entry = [string, string, number, number, number, number, [number, number, number, number, 0 | 1][]];

type Verified0606Entry = {
  physicalSizePt: [number, number];
  imageDimensions: [number, number];
  segments: [number, number, number, number][];
};

/** Historical 0580 receipt plus the reviewed Core 2026 addition; an addition may never redefine a pair. */
const verified0580Entries: Record<string, [Verified0580Entry | null, Verified0580Entry | null]> = (() => {
  const merged = { ...(verified0580.entries as unknown as Record<string, [Verified0580Entry | null, Verified0580Entry | null]>) };
  for (const [id, pair] of Object.entries(verified0580Core2026.entries as unknown as Record<string, [Verified0580Entry, Verified0580Entry]>)) {
    if (merged[id]) throw new Error(`0580 print geometry addition overlaps ${id}`);
    merged[id] = pair;
  }
  return merged;
})();

/** Geometry of the reviewed 0580 Core crop repairs, keyed to their new immutable paths only. */
const repaired0580Entries = verified0580CoreCropRepairs.entries as unknown as Record<string, [Verified0580Entry | null, Verified0580Entry | null]>;

/** Historical 1,633-pair receipt plus reviewed additions; an addition may never redefine a pair. */
const verified0606Entries: Record<string, [Verified0606Entry, Verified0606Entry]> = (() => {
  const merged = { ...(verified0606.entries as unknown as Record<string, [Verified0606Entry, Verified0606Entry]>) };
  for (const [id, pair] of Object.entries(verified0606March2026.entries as unknown as Record<string, [Verified0606Entry, Verified0606Entry]>)) {
    if (merged[id]) throw new Error(`0606 print geometry addition overlaps ${id}`);
    merged[id] = pair;
  }
  return merged;
})();

/** Only exact, source-audited crop paths may carry physical print dimensions. */
function geometryForSignedPath(
  bank: BankSlug, questionId: string, kind: "question" | "answer", path: string,
): { size: PhysicalSizePt; rasterSize?: [number, number]; segments?: SourcePrintSegment[] } | null {
  if (bank === "igcse") {
    const index = kind === "question" ? 0 : 1;
    const entry = [repaired0580Entries[questionId]?.[index], verified0580Entries[questionId]?.[index]]
      .find((candidate) => candidate && (path === candidate[0] || path.endsWith(`/${candidate[0]}`)));
    if (!entry) return null;
    const [, imageSha256, widthPx, heightPx, widthPt, heightPt, segments] = entry;
    return {
      size: [widthPt, heightPt],
      rasterSize: [widthPx, heightPx],
      // Blank exam pages carry the image hash so the exporter can prove the bytes before hiding them.
      segments: segments.map(([sourceY, sourceHeight, physicalHeightPt, sourcePage, include]) => ({
        sourceY, sourceHeight, physicalHeightPt, sourcePage, ...(include ? {} : { include: false, imageSha256 }),
      })),
    };
  }
  if (bank === "igcse-additional") {
    // A reviewed edge repair keeps the historical vertical geometry at its wider width.
    // So does a reviewed question split, at its own question's segment.
    const repaired = kind === "answer" ? reviewed0606RightEdgeGeometry(questionId, path) : reviewed0606SplitGeometry(questionId, path);
    if (repaired) {
      return {
        size: repaired.physicalSizePt,
        rasterSize: repaired.imageDimensions,
        segments: repaired.segments.map(([sourceY, sourceHeight, physicalHeightPt, sourcePage]) => ({ sourceY, sourceHeight, physicalHeightPt, sourcePage })),
      };
    }
    const pair = verified0606Entries[questionId];
    const folder = kind === "question" ? "questions" : "markschemes";
    const expected = `${folder}/${questionId}.webp`;
    if (!pair || (path !== expected && !path.endsWith(`/${expected}`))) return null;
    const entry = pair[kind === "question" ? 0 : 1];
    const reviewed = reviewedBlankTailForSignedAsset(bank, questionId, kind, path);
    const reviewedPage = reviewed ? reviewedBlankSourcePage(questionId) : null;
    return {
      size: entry.physicalSizePt,
      rasterSize: entry.imageDimensions,
      segments: entry.segments.map(([sourceY, sourceHeight, physicalHeightPt, sourcePage], index) => {
        const tailIsApproved = reviewed && index === entry.segments.length - 1 &&
          sourceY === reviewed.visibleHeightPx && sourceY + sourceHeight === entry.imageDimensions[1] &&
          sourcePage === reviewedPage;
        return { sourceY, sourceHeight, physicalHeightPt, sourcePage, ...(tailIsApproved ? { include: false, imageSha256: reviewed.imageSha256 } : {}) };
      }),
    };
  }
  return null;
}

export function printGeometryForSignedAssets(
  bank: BankSlug, questionId: string, kind: "question" | "answer", paths: readonly string[],
) {
  const geometries = paths.map((path) => geometryForSignedPath(bank, questionId, kind, path));
  return {
    printSizesPt: geometries.map((entry) => entry?.size ?? null),
    printSegments: geometries.map((entry) => entry?.segments ?? null),
    rasterSizesPx: geometries.map((entry) => entry?.rasterSize ?? null),
  };
}

export function printSizesForSignedAssets(
  bank: BankSlug, questionId: string, kind: "question" | "answer", paths: readonly string[],
): Array<PhysicalSizePt | null> {
  return printGeometryForSignedAssets(bank, questionId, kind, paths).printSizesPt;
}
