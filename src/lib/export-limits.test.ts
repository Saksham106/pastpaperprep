import { describe, expect, it } from "vitest";
import { MAX_DAILY_PDF_QUESTIONS, MAX_DAILY_SIGNED_ASSETS, MAX_PDF_QUESTIONS, validPdfQuestionCount } from "@/lib/export-limits";

describe("PDF export limits", () => {
  it("publishes 5000 daily assets while retaining both question caps", () => {
    expect(MAX_DAILY_SIGNED_ASSETS).toBe(5000);
    expect(MAX_DAILY_PDF_QUESTIONS).toBe(150);
    expect(MAX_PDF_QUESTIONS).toBe(50);
  });
  it("accepts only bounded whole question counts", () => {
    expect(validPdfQuestionCount(1)).toBe(true);
    expect(validPdfQuestionCount(MAX_PDF_QUESTIONS)).toBe(true);
    expect(validPdfQuestionCount(0)).toBe(false);
    expect(validPdfQuestionCount(MAX_PDF_QUESTIONS + 1)).toBe(false);
    expect(validPdfQuestionCount(1.5)).toBe(false);
  });
});
