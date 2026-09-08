import { describe, expect, it } from "vitest";
import { PREVIEW_QUESTION_IDS } from "@/lib/access";
import { BANKS } from "@/lib/banks";
import { getQuestionRichDetails } from "@/lib/question-delivery";
import { createPublicBankIndex, mergeQuestionRichDetails, publicMetadataToQuestion, toPublicQuestionMetadata } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-fixtures";

const BANK_SLUGS = BANKS.map((bank) => bank.slug);

describe("public bank question index", () => {
  it("contains deterministic metadata only and preserves filterable classification", () => {
    const questions = loadBankQuestions("ib-sl");
    const first = createPublicBankIndex("ib-sl", questions);
    const second = createPublicBankIndex("ib-sl", questions);
    const serialized = JSON.stringify(first);
    const preview = first.questions.find((question) => question.id === PREVIEW_QUESTION_IDS["ib-sl"][0]);

    expect(first).toEqual(second);
    expect(first.version).toBe(1);
    expect(first.bank).toBe("ib-sl");
    expect(first.questions).toHaveLength(questions.length);
    expect(preview).toMatchObject({
      id: PREVIEW_QUESTION_IDS["ib-sl"][0],
      primaryTopic: expect.any(String),
      skills: expect.any(Array),
      subtopics: expect.any(Array),
    });
    expect(preview).not.toHaveProperty("courseEra");
    expect(serialized).not.toContain("accessibleText");
    expect(serialized).not.toContain("summary");
    expect(serialized).not.toContain("solution");
    expect(serialized).not.toContain("sourceQuestionUrl");
    expect(serialized).not.toContain("sourceMarkSchemeUrl");
    expect(serialized).not.toContain("questionImages");
    expect(serialized).not.toContain("markschemeImages");
    expect(serialized).not.toContain("questionAssetPaths");
    expect(serialized).not.toContain("markschemeAssetPaths");
  });

  it("merges authorized rich fields without replacing metadata-only search", () => {
    const question = loadBankQuestions("ib-sl")[0];
    const metadataQuestion = publicMetadataToQuestion(toPublicQuestionMetadata(question), "ib-sl");
    const merged = mergeQuestionRichDetails(metadataQuestion, getQuestionRichDetails(question, [{
      productId: "bank_ib_sl",
      status: "active",
      startsAt: "2026-01-01T00:00:00Z",
      expiresAt: null,
    }]));

    expect(merged.searchText).toBe(metadataQuestion.searchText);
    expect(merged.accessibleText).toBe(question.accessibleText);
  });

  it("does not expose protected question text even when metadata is built from a rich record", () => {
    const question = loadBankQuestions("ib-sl")[0];
    const metadata = toPublicQuestionMetadata(question);

    expect(metadata).not.toHaveProperty("searchText");
    expect(metadata).not.toHaveProperty("accessibleText");
    expect(metadata).not.toHaveProperty("solution");
    expect(metadata).not.toHaveProperty("sourceQuestionUrl");
    expect(metadata).not.toHaveProperty("sourceMarkSchemeUrl");
  });

  it("omits courseEra from runtime metadata for every bank", () => {
    for (const bank of BANK_SLUGS) {
      const metadata = toPublicQuestionMetadata(loadBankQuestions(bank)[0]);
      expect(metadata).not.toHaveProperty("courseEra");
      expect(JSON.stringify(createPublicBankIndex(bank, loadBankQuestions(bank)))).not.toContain("courseEra");
    }
  }, 20_000);

});
