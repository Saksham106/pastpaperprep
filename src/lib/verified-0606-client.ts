import reviewed from "@/data/reviewed-blank-tails-0606.json";
import type { PdfExportQuestion } from "@/lib/pdf-export";

type SourceEntry = {
  physicalSizePt: [number, number];
  imageDimensions: [number, number];
  segments: [number, number, number, number][];
};
type ReviewedTail = {
  path: string;
  imageSha256: string;
  rasterSizePx: [number, number];
  visibleHeightPx: number;
  blankSourcePage: number;
};

/** Compare signer metadata against the independent, immutable client-side source receipt. */
export async function verify0606PdfMetadata(
  question: PdfExportQuestion, kind: "question" | "answer", index: number,
): Promise<void> {
  if (question.bankSlug !== "igcse-additional") return;
  const source = (await import("@/data/print-geometry-0606.json")).default;
  const entry = (source.entries as unknown as Record<string, [SourceEntry, SourceEntry]>)[question.id]
    ?.[kind === "question" ? 0 : 1];
  const images = kind === "question" ? question.questionImages : question.markschemeImages;
  const sizes = kind === "question" ? question.questionPrintSizesPt : question.markschemePrintSizesPt;
  const rasters = kind === "question" ? question.questionRasterSizesPx : question.markschemeRasterSizesPx;
  const segments = kind === "question" ? question.questionPrintSegments : question.markschemePrintSegments;
  const actual = segments?.[index];
  const fail = () => { throw new Error("Verified source geometry disagrees with the 0606 source receipt"); };
  if (!entry || images.length !== 1 || index !== 0 || !actual ||
    sizes?.length !== 1 || rasters?.length !== 1 || segments?.length !== 1 ||
    !sizes[0] || !rasters[0] || actual.length !== entry.segments.length ||
    sizes[0].some((number, axis) => number !== entry.physicalSizePt[axis]) ||
    rasters[0].some((number, axis) => number !== entry.imageDimensions[axis])) fail();
  const tail = kind === "question"
    ? (reviewed.entries as unknown as Record<string, ReviewedTail>)[question.id] : undefined;
  for (const [partIndex, expected] of entry.segments.entries()) {
    const candidate = actual![partIndex];
    if ([candidate.sourceY, candidate.sourceHeight, candidate.physicalHeightPt, candidate.sourcePage]
      .some((number, axis) => number !== expected[axis])) fail();
    const reviewedLast = Boolean(tail && partIndex === entry.segments.length - 1 &&
      tail.path === `questions/${question.id}.webp` &&
      tail.rasterSizePx[0] === entry.imageDimensions[0] && tail.rasterSizePx[1] === entry.imageDimensions[1] &&
      tail.visibleHeightPx === expected[0] && tail.blankSourcePage === expected[3] &&
      expected[0] + expected[1] === entry.imageDimensions[1]);
    if (reviewedLast) {
      if (candidate.include !== false || candidate.imageSha256 !== tail!.imageSha256) fail();
    } else if (candidate.include === false || candidate.imageSha256 !== undefined) fail();
  }
}
