import core0580 from "@/data/print-geometry-0580-core.json";
import verified0606 from "@/data/print-geometry-0606.json";
import type { BankSlug } from "@/lib/banks";
import { reviewedBlankTailForSignedAsset, reviewedBlankSourcePage } from "@/lib/reviewed-blank-tails";

export type PhysicalSizePt = readonly [number, number];
export type SourcePrintSegment = {
  imageSha256?: string;
  sourceY: number;
  sourceHeight: number;
  physicalHeightPt: number;
  sourcePage: number;
  include?: boolean;
};

type Verified0606Entry = {
  physicalSizePt: [number, number];
  imageDimensions: [number, number];
  segments: [number, number, number, number][];
};

/** Only exact, source-audited crop paths may carry physical print dimensions. */
function geometryForSignedPath(
  bank: BankSlug, questionId: string, kind: "question" | "answer", path: string,
): { size: PhysicalSizePt; rasterSize?: [number, number]; segments?: SourcePrintSegment[] } | null {
  if (bank === "igcse") {
    const pair = (core0580.entries as unknown as Record<string, [PhysicalSizePt, PhysicalSizePt]>)[questionId];
    const folder = kind === "question" ? "core-questions" : "core-markschemes";
    const expected = `${folder}/${questionId}.webp`;
    if (!pair || (path !== expected && !path.endsWith(`/${expected}`))) return null;
    return { size: pair[kind === "question" ? 0 : 1] };
  }
  if (bank === "igcse-additional") {
    const pair = (verified0606.entries as unknown as Record<string, [Verified0606Entry, Verified0606Entry]>)[questionId];
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
