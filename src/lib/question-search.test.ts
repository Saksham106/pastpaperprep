import { describe, expect, it } from "vitest";
import { PREVIEW_QUESTION_IDS, type AccessEntitlement } from "@/lib/access";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { searchQuestionIds } from "@/lib/question-search";

function entitlement(productId: AccessEntitlement["productId"]): AccessEntitlement {
  return {
    productId,
    status: "active",
    startsAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null,
  };
}

describe("authorization-aware question search", () => {
  it("searches rich text for an authorized user without exposing it in the result", () => {
    const source = loadBankQuestions("ib-sl").find((question) => !PREVIEW_QUESTION_IDS["ib-sl"].includes(question.id))!;
    const question = { ...source, searchText: "metadata protected theorem phrase" };

    expect(searchQuestionIds([question], "protected theorem", [entitlement("bank_ib_sl")])).toEqual([question.id]);
    expect(searchQuestionIds([question], "protected theorem", [])).toEqual([]);
  });

  it("keeps rich search for public preview questions but only metadata for locked questions", () => {
    const questions = loadBankQuestions("ib-sl");
    const preview = { ...questions.find((question) => question.id === PREVIEW_QUESTION_IDS["ib-sl"][0])!, searchText: "preview protected phrase" };
    const locked = { ...questions.find((question) => !PREVIEW_QUESTION_IDS["ib-sl"].includes(question.id))!, searchText: "locked protected phrase" };

    expect(searchQuestionIds([preview, locked], "preview protected", [])).toEqual([preview.id]);
    expect(searchQuestionIds([preview, locked], "locked protected", [])).toEqual([]);
    expect(searchQuestionIds([preview], "preview protected", [])).toContain(preview.id);
  });

  it("uses the same metadata representation as the public index for metadata matches", () => {
    const source = loadBankQuestions("ib-sl")[0];

    expect(searchQuestionIds([source], source.primaryTopic, [])).toEqual([source.id]);
    expect(searchQuestionIds([source], String(source.year), [])).toEqual([source.id]);
  });
});
