import type { AssetManifestEntry } from "@/lib/asset-manifest";
import type { UnifiedQuestion } from "@/lib/questions";

/** Prebuild only (scripts/generate-asset-manifest.mts): the per-bank lookup the signing routes read. */
export function buildBankAssetManifest(questions: readonly UnifiedQuestion[]): Record<string, AssetManifestEntry> {
  const manifest: Record<string, AssetManifestEntry> = {};
  for (const question of questions) {
    manifest[question.id] = {
      questionAssetPaths: question.questionAssetPaths,
      markschemeAssetPaths: question.markschemeAssetPaths,
      ...(question.explanationAssetPaths?.length ? { explanationAssetPaths: question.explanationAssetPaths } : {}),
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
