import { describe, expect, it } from "vitest";
import { BANKS } from "@/lib/banks";
import { buildAssetRetentionPlan } from "@/lib/asset-retention";
import { loadBankQuestions } from "@/lib/question-fixtures";

describe("buildAssetRetentionPlan", () => {
  it("derives preview retention from every normalized runtime asset path", () => {
    const plan = buildAssetRetentionPlan(
      BANKS.map((bank) => ({ slug: bank.slug, questions: loadBankQuestions(bank.slug) })),
    );

    expect(plan.allPaths.size).toBe(26_147);
    expect(plan.previewPaths.size).toBe(4_020);
    expect(plan.premiumPaths.size).toBe(22_127);
    expect(plan.previewPaths.has("ib-hl/markschemes/2017-may-tz1-p1-q1-page-7.webp")).toBe(true);
    expect(plan.previewPaths.has("ib-physics-hl/markschemes/2020-november-tz0-hl-p1-q1-page-3.webp")).toBe(true);
    expect([...plan.previewPaths].every((path) => plan.allPaths.has(path))).toBe(true);
    expect([...plan.premiumPaths].every((path) => !plan.previewPaths.has(path))).toBe(true);
  });
});
