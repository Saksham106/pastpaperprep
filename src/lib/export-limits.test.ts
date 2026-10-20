import { describe, expect, it } from "vitest";
import { MAX_PDF_QUESTIONS, validPdfQuestionCount } from "@/lib/export-limits";

describe("PDF export limits", () => {
  it("accepts only bounded whole question counts", () => {
    expect(validPdfQuestionCount(1)).toBe(true);
    expect(validPdfQuestionCount(MAX_PDF_QUESTIONS)).toBe(true);
    expect(validPdfQuestionCount(0)).toBe(false);
    expect(validPdfQuestionCount(MAX_PDF_QUESTIONS + 1)).toBe(false);
    expect(validPdfQuestionCount(1.5)).toBe(false);
  });
});
