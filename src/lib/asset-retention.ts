import { isPreviewQuestion } from "@/lib/access";
import type { BankSlug } from "@/lib/banks";
import type { UnifiedQuestion } from "@/lib/questions";

type BankQuestions = {
  slug: BankSlug;
  questions: readonly UnifiedQuestion[];
};

export type AssetRetentionPlan = {
  allPaths: Set<string>;
  previewPaths: Set<string>;
  premiumPaths: Set<string>;
};

/**
 * Derive storage retention from the same normalized paths and preview policy
 * used by the signing route. Shared paths stay in Supabase if any preview
 * question can request them.
 */
export function buildAssetRetentionPlan(banks: readonly BankQuestions[]): AssetRetentionPlan {
  const allPaths = new Set<string>();
  const previewPaths = new Set<string>();

  for (const { slug, questions } of banks) {
    for (const question of questions) {
      const paths = [...question.questionAssetPaths, ...question.markschemeAssetPaths];
      for (const path of paths) allPaths.add(path);
      if (isPreviewQuestion(slug, question.id)) {
        for (const path of paths) previewPaths.add(path);
      }
    }
  }

  const premiumPaths = new Set([...allPaths].filter((path) => !previewPaths.has(path)));
  return { allPaths, previewPaths, premiumPaths };
}
