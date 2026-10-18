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
  igcse: { preview: 1436, premium: 6912, all: 8348 },
  "igcse-additional": { preview: 956, premium: 2356, all: 3312 },
  // Six source-owned foreign-only tails retired; restoration objects replace old images one-for-one.
  // May 2026: donated reconstructions retired for the official TZ1-TZ3 papers and markschemes.
  "ib-hl": { preview: 314, premium: 2971, all: 3285 },
  "ib-sl": { preview: 147, premium: 1413, all: 1560 },
  // Reviewed Q12 foreign-only tail retired; Q13 immutable restoration is a one-for-one replacement.
  // May 2026: official Chemistry papers add 409 (HL) and 288 (SL) premium crops; 2026 is not a free-preview year.
  // May 2026: official AI TZ1-TZ3 papers added (+254 HL, +161 SL images, all premium).
  "ib-ai-hl": { preview: 236, premium: 1370, all: 1606 },
  "ib-ai-sl": { preview: 155, premium: 1008, all: 1163 },
  // Shared-stimulus repair (docs/ib-shared-stimulus-repairs.md): one 2017 Paper 3 data-block crop each.
  "ib-chemistry-hl": { preview: 232, premium: 5806, all: 6038 },
  "ib-chemistry-sl": { preview: 159, premium: 4166, all: 4325 },
  // May 2026: official Physics papers add 395 (HL) and 258 (SL) premium crops; 2026 is not a free-preview year.
  "ib-physics-hl": { preview: 226, premium: 5790, all: 6016 },
  "ib-physics-sl": { preview: 159, premium: 3894, all: 4053 },
  // May 2026: official papers add 380 (HL; the withheld 2026-may-tz1-hl-p1b-q2 serves none) and 295 (SL) premium crops; 2026 is not a free-preview year.
  // Shared-stimulus repair: HL +6 new crops, 4 no longer served; SL +4 new (the 2020 micrograph is free preview), 2 no longer served.
  "ib-biology-hl": { preview: 211, premium: 5782, all: 5993 },
  "ib-biology-sl": { preview: 156, premium: 4512, all: 4668 },
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
