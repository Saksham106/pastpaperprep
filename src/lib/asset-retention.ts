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

/** Canonical retained-asset census for the current runtime bank corpus. */
export const EXPECTED_ASSET_COUNTS = {
  igcse: { preview: 1436, premium: 6498, all: 7934 },
  "igcse-additional": { preview: 956, premium: 2310, all: 3266 },
  "ib-hl": { preview: 314, premium: 2708, all: 3022 },
  "ib-sl": { preview: 147, premium: 1316, all: 1463 },
  "ib-ai-hl": { preview: 236, premium: 1117, all: 1353 },
  "ib-ai-sl": { preview: 155, premium: 847, all: 1002 },
  "ib-chemistry-hl": { preview: 232, premium: 5396, all: 5628 },
  "ib-chemistry-sl": { preview: 159, premium: 3877, all: 4036 },
  "ib-physics-hl": { preview: 226, premium: 5395, all: 5621 },
  "ib-physics-sl": { preview: 159, premium: 3636, all: 3795 },
  "ib-biology-hl": { preview: 211, premium: 5400, all: 5611 },
  "ib-biology-sl": { preview: 155, premium: 4216, all: 4371 },
} as const satisfies Record<string, { preview: number; premium: number; all: number }>;

export const EXPECTED_ASSET_TOTALS = Object.values(EXPECTED_ASSET_COUNTS).reduce(
  (totals, counts) => ({
    preview: totals.preview + counts.preview,
    premium: totals.premium + counts.premium,
    all: totals.all + counts.all,
  }),
  { preview: 0, premium: 0, all: 0 },
);

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
