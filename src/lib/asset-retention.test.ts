import { describe, expect, it } from "vitest";
import { BANKS } from "@/lib/banks";
import { buildAssetRetentionPlan, EXPECTED_ASSET_COUNTS, EXPECTED_ASSET_TOTALS } from "@/lib/asset-retention";
import { loadBankQuestions } from "@/lib/question-fixtures";

describe("buildAssetRetentionPlan", () => {
  it("derives preview retention from every normalized runtime asset path", () => {
    const plan = buildAssetRetentionPlan(
      BANKS.map((bank) => ({ slug: bank.slug, questions: loadBankQuestions(bank.slug) })),
    );

    expect(plan.allPaths.size).toBe(EXPECTED_ASSET_TOTALS.all);
    expect(plan.previewPaths.size).toBe(EXPECTED_ASSET_TOTALS.preview);
    expect(plan.premiumPaths.size).toBe(EXPECTED_ASSET_TOTALS.premium);
    expect(plan.previewPaths.has("ib-hl/markschemes/2017-may-tz1-p1-q1-page-7.webp")).toBe(true);
    expect(plan.previewPaths.has("ib-physics-hl/markschemes/2020-november-tz0-hl-p1-q1-page-3.webp")).toBe(true);
    expect([...plan.previewPaths].every((path) => plan.allPaths.has(path))).toBe(true);
    expect([...plan.premiumPaths].every((path) => !plan.previewPaths.has(path))).toBe(true);
  }, 20_000);

  it("matches the canonical census exactly for every bank and aggregate", () => {
    const plan = buildAssetRetentionPlan(
      BANKS.map((bank) => ({ slug: bank.slug, questions: loadBankQuestions(bank.slug) })),
    );

    for (const [bank, expected] of Object.entries(EXPECTED_ASSET_COUNTS)) {
      expect([...plan.allPaths].filter((path) => path.startsWith(`${bank}/`)), bank).toHaveLength(expected.all);
      expect([...plan.previewPaths].filter((path) => path.startsWith(`${bank}/`)), `${bank} preview`).toHaveLength(expected.preview);
      expect([...plan.premiumPaths].filter((path) => path.startsWith(`${bank}/`)), `${bank} premium`).toHaveLength(expected.premium);
    }
    expect(plan.allPaths.size).toBe(EXPECTED_ASSET_TOTALS.all);
    expect(plan.previewPaths.size).toBe(EXPECTED_ASSET_TOTALS.preview);
    expect(plan.premiumPaths.size).toBe(EXPECTED_ASSET_TOTALS.premium);
  }, 20_000);
});
