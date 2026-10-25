import { isPreviewQuestion } from "@/lib/access";
import type { BankSlug } from "@/lib/banks";
import { previewAssetSignOptions } from "@/lib/private-asset-providers";
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
  // MS row repair (docs/ib-maths-ms-row-repairs.md): 2024 May TZ1 P3 Q1/Q2 answers go from 9 crops to 8 (-1).
  "ib-ai-hl": { preview: 236, premium: 1369, all: 1605 },
  "ib-ai-sl": { preview: 155, premium: 1008, all: 1163 },
  // Shared-stimulus repair (docs/ib-shared-stimulus-repairs.md): one 2017 Paper 3 data-block crop each.
  // IB science crop repair (docs/ib-science-crop-repairs.md): 2023 May TZ2 P2 Q6 page-13 and page-14 answer crops become one (-1).
  // Oct 2026: IB science free years widened to 2016-2020 and signed from R2, so Supabase retains no IB science previews.
  "ib-chemistry-hl": { preview: 0, premium: 6166, all: 6166 },
  "ib-chemistry-sl": { preview: 0, premium: 4325, all: 4325 },
  // May 2026: official Physics papers add 395 (HL) and 258 (SL) premium crops; 2026 is not a free-preview year.
  "ib-physics-hl": { preview: 0, premium: 6016, all: 6016 },
  "ib-physics-sl": { preview: 0, premium: 4053, all: 4053 },
  // May 2026: official papers add 380 (HL; the withheld 2026-may-tz1-hl-p1b-q2 serves none) and 295 (SL) premium crops; 2026 is not a free-preview year.
  // Shared-stimulus repair: HL +6 new crops, 4 no longer served; SL +4 new (the 2020 micrograph is free preview), 2 no longer served.
  // Question-boundary repair (docs/ib-question-boundary-repairs.md): Q1/Q2 re-cut in five papers, HL -4 and SL -2 net.
  "ib-biology-hl": { preview: 0, premium: 5989, all: 5989 },
  "ib-biology-sl": { preview: 0, premium: 4666, all: 4666 },
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
 * question can request them from Supabase; banks whose previews sign from R2
 * retain nothing there.
 */
export function buildAssetRetentionPlan(banks: readonly BankQuestions[]): AssetRetentionPlan {
  const allPaths = new Set<string>();
  const previewPaths = new Set<string>();

  for (const { slug, questions } of banks) {
    const previewsInSupabase = previewAssetSignOptions(slug).provider === "supabase";
    for (const question of questions) {
      const paths = [...question.questionAssetPaths, ...question.markschemeAssetPaths];
      for (const path of paths) allPaths.add(path);
      if (previewsInSupabase && isPreviewQuestion(slug, question.id)) {
        for (const path of paths) previewPaths.add(path);
      }
    }
  }

  const premiumPaths = new Set([...allPaths].filter((path) => !previewPaths.has(path)));
  return { allPaths, previewPaths, premiumPaths };
}
