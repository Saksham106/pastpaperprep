import { describe, expect, it } from "vitest";
import {
  MAX_PDF_QUESTIONS,
  PDF_BOOK_LOGO_PATH,
  darkenPdfPixel,
  paginatePdfText,
  pdfFooterText,
  pdfPageLabel,
  planPdfImageSlices,
  questionsForPdf,
} from "@/lib/pdf-export";
import { loadBankQuestions } from "@/lib/question-fixtures";

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

  it("uses the same open-book mark as the website instead of a placeholder letter", () => {
    expect(PDF_BOOK_LOGO_PATH).toContain("M232,48H160");
    expect(PDF_BOOK_LOGO_PATH).not.toContain("PastPaperPrep");
  });

  it("keeps tall multi-page crops readable by slicing them at full printable width", () => {
    const slices = planPdfImageSlices(1070, 3082);

    expect(slices).toHaveLength(3);
    expect(slices.every((slice) => slice.renderedWidth >= 190)).toBe(true);
    expect(slices.every((slice) => slice.renderedHeight <= 248)).toBe(true);
    expect(slices.reduce((height, slice) => height + slice.sourceHeight, 0)).toBe(3082);
  });

  it("keeps a normal exam page together when it fits the printable area", () => {
    const slices = planPdfImageSlices(1191, 1524);

    expect(slices).toHaveLength(1);
    expect(slices[0].renderedWidth).toBeGreaterThan(190);
    expect(slices[0].renderedHeight).toBeLessThanOrEqual(248);
  });

  it("darkens faint print without changing white paper or pure black ink", () => {
    expect(darkenPdfPixel(255)).toBe(255);
    expect(darkenPdfPixel(0)).toBe(0);
    expect(darkenPdfPixel(220)).toBeLessThan(210);
    expect(darkenPdfPixel(128)).toBeLessThan(115);
  });

  it("paginates long text answers before they can collide with the footer", () => {
    const lines = Array.from({ length: 101 }, (_, index) => `Answer line ${index + 1}`);
    const pages = paginatePdfText(lines);

    expect(pages.map((page) => page.length)).toEqual([48, 48, 5]);
    expect(pages.flat()).toEqual(lines);
    expect(() => paginatePdfText(lines, 0)).toThrow("positive integer");
  });
});