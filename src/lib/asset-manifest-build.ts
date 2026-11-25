import type { AssetManifestEntry } from "@/lib/asset-manifest";
import type { ImageSize } from "@/lib/image-sizes";
import type { McqAnswer } from "@/lib/mcq-answer";
import type { UnifiedQuestion } from "@/lib/questions";

/** Prebuild only (scripts/generate-asset-manifest.mts): the per-bank lookup the signing routes read. */
export function buildBankAssetManifest(
  questions: readonly UnifiedQuestion[],
  mcqAnswers: ReadonlyMap<string, McqAnswer> = new Map(),
  sizeOf: (path: string) => ImageSize | null = () => null,
): Record<string, AssetManifestEntry> {
  // Sizes only where at least one is known, so banks without a size file keep their old manifest.
  const sizesFor = (paths: readonly string[]) => {
    const sizes = paths.map((path) => { const size = sizeOf(path); return size ? [size[0], size[1]] as [number, number] : null; });
    return sizes.some(Boolean) ? sizes : undefined;
  };
  const manifest: Record<string, AssetManifestEntry> = {};
  const known = new Set(questions.map((question) => question.id));
  for (const id of mcqAnswers.keys()) if (!known.has(id)) throw new Error(`MCQ answer letter for an unknown question: ${id}`);
  for (const question of questions) {
    const mcqAnswer = mcqAnswers.get(question.id);
    const questionAssetSizes = sizesFor(question.questionAssetPaths);
    const markschemeAssetSizes = sizesFor(question.markschemeAssetPaths);
    manifest[question.id] = {
      questionAssetPaths: question.questionAssetPaths,
      markschemeAssetPaths: question.markschemeAssetPaths,
      ...(question.explanationAssetPaths?.length ? { explanationAssetPaths: question.explanationAssetPaths } : {}),
      ...(mcqAnswer ? { mcqAnswer } : {}),
      ...(questionAssetSizes ? { questionAssetSizes } : {}),
      ...(markschemeAssetSizes ? { markschemeAssetSizes } : {}),
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
