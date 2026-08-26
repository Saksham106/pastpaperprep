import { describe, expect, it } from "vitest";
import { MAX_PDF_QUESTIONS, pdfFooterText, pdfPageLabel, questionsForPdf } from "@/lib/pdf-export";
import { loadBankQuestions } from "@/lib/questions";

describe("questionsForPdf", () => {
  const questions = loadBankQuestions("ib-sl").slice(0, 4);

  it("exports all current matches until the user makes an explicit selection", () => {
    expect(questionsForPdf(questions, new Set(), false)).toEqual(questions);
  });

  it("keeps explicit selections even when they are outside current filters", () => {
    const selected = new Set([questions[0].id, questions[3].id]);
    expect(questionsForPdf(questions.slice(0, 2), selected, true, questions)).toEqual([
      questions[0],
      questions[3],
    ]);
  });

  it("caps a single worksheet before signing or downloading assets", () => {
    const manyQuestions = loadBankQuestions("ib-sl").slice(0, MAX_PDF_QUESTIONS + 5);
    expect(questionsForPdf(manyQuestions, new Set(), false)).toHaveLength(MAX_PDF_QUESTIONS);
  });

  it("adds an account-linked personal-use footer", () => {
    expect(pdfFooterText("A1B2C3D4")).toBe("PastPaperPrep • Account A1B2C3D4 • Personal study only");
    expect(pdfPageLabel(2, 7)).toBe("Page 2 of 7");
  });
});