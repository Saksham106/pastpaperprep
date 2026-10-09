import verified0580 from "@/data/print-geometry-0580.json";
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

/** [path, imageSha256, widthPx, heightPx, widthPt, heightPt, [sourceY, sourceHeight, physicalHeightPt, sourcePage, include][]] */
type Verified0580Entry = [string, string, number, number, number, number, [number, number, number, number, 0 | 1][]];

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
    const entry = (verified0580.entries as unknown as Record<string, [Verified0580Entry | null, Verified0580Entry | null]>)[questionId]
      ?.[kind === "question" ? 0 : 1];
    if (!entry || (path !== entry[0] && !path.endsWith(`/${entry[0]}`))) return null;
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
