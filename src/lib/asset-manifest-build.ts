import type { AssetManifestEntry } from "@/lib/asset-manifest";
import type { McqAnswer } from "@/lib/mcq-answer";
import type { UnifiedQuestion } from "@/lib/questions";

/** Prebuild only (scripts/generate-asset-manifest.mts): the per-bank lookup the signing routes read. */
export function buildBankAssetManifest(
  questions: readonly UnifiedQuestion[],
  mcqAnswers: ReadonlyMap<string, McqAnswer> = new Map(),
): Record<string, AssetManifestEntry> {
  const manifest: Record<string, AssetManifestEntry> = {};
  const known = new Set(questions.map((question) => question.id));
  for (const id of mcqAnswers.keys()) if (!known.has(id)) throw new Error(`MCQ answer letter for an unknown question: ${id}`);
  for (const question of questions) {
    const mcqAnswer = mcqAnswers.get(question.id);
    manifest[question.id] = {
      questionAssetPaths: question.questionAssetPaths,
      markschemeAssetPaths: question.markschemeAssetPaths,
      ...(question.explanationAssetPaths?.length ? { explanationAssetPaths: question.explanationAssetPaths } : {}),
      ...(mcqAnswer ? { mcqAnswer } : {}),
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
