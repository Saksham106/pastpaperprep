import { describe, expect, it } from "vitest";
import { BANKS } from "@/lib/banks";
import { buildAssetRetentionPlan } from "@/lib/asset-retention";
import { loadBankQuestions } from "@/lib/question-fixtures";

describe("buildAssetRetentionPlan", () => {
  it("derives preview retention from every normalized runtime asset path", () => {
    const plan = buildAssetRetentionPlan(
      BANKS.map((bank) => ({ slug: bank.slug, questions: loadBankQuestions(bank.slug) })),
    );

    expect(plan.allPaths.size).toBe(20_951);
    expect(plan.previewPaths.size).toBe(3_635);
    expect(plan.premiumPaths.size).toBe(17_316);
    expect(plan.previewPaths.has("ib-hl/markschemes/2017-may-tz1-p1-q1-page-7.webp")).toBe(true);
    expect([...plan.previewPaths].every((path) => plan.allPaths.has(path))).toBe(true);
    expect([...plan.premiumPaths].every((path) => !plan.previewPaths.has(path))).toBe(true);
  });
});
