import { describe, expect, it } from "vitest";
import { PREVIEW_QUESTION_IDS, type AccessEntitlement } from "@/lib/access";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import { loadBankQuestions } from "@/lib/questions";

function entitlement(productId: AccessEntitlement["productId"]): AccessEntitlement {
  return {
    productId,
    status: "active",
    startsAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
  };
}

describe("prepareQuestionsForDelivery", () => {
  const now = new Date("2026-08-25T16:30:00.000Z");
  const questions = loadBankQuestions("ib-sl");
  const previewId = PREVIEW_QUESTION_IDS["ib-sl"][0];
  const preview = questions.find((question) => question.id === previewId)!;
  const locked = questions.find((question) => !PREVIEW_QUESTION_IDS["ib-sl"].includes(question.id))!;

  it("never serializes public asset URLs or private storage paths", () => {
    const delivered = prepareQuestionsForDelivery([preview, locked], [], now);

    for (const question of delivered) {
      expect(question.questionImages).toEqual([]);
      expect(question.markschemeImages).toEqual([]);
      expect(question.questionAssetPaths).toEqual([]);
      expect(question.markschemeAssetPaths).toEqual([]);
    }

    expect(delivered[0].questionImageCount).toBe(preview.questionImages.length);
    expect(delivered[0].markschemeImageCount).toBe(preview.markschemeImages.length);
  });

  it("keeps preview transcripts and answers while stripping locked question content", () => {
    const [deliveredPreview, deliveredLocked] = prepareQuestionsForDelivery([preview, locked], [], now);

    expect(deliveredPreview.accessibleText).toBe(preview.accessibleText);
    expect(deliveredPreview.solution).toBe(preview.solution);
    expect(deliveredLocked.accessibleText).toBe("");
    expect(deliveredLocked.solution).toBeNull();
    expect(deliveredLocked.summary).toBe("");
    expect(deliveredLocked.sourceQuestionUrl).toBeNull();
    expect(deliveredLocked.sourceMarkSchemeUrl).toBeNull();
    expect(deliveredLocked.searchText).not.toContain(locked.accessibleText.toLocaleLowerCase());
    if (locked.solution) expect(deliveredLocked.searchText).not.toContain(locked.solution.toLocaleLowerCase());
  });

  it("keeps paid content for a current bank entitlement", () => {
    const [delivered] = prepareQuestionsForDelivery([locked], [entitlement("bank_ib_sl")], now);

    expect(delivered.accessibleText).toBe(locked.accessibleText);
    expect(delivered.solution).toBe(locked.solution);
    expect(delivered.searchText).toBe(locked.searchText);
  });
});
