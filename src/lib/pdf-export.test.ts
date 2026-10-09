import { describe, expect, it } from "vitest";
import {
  MAX_PDF_QUESTIONS,
  PDF_BOOK_LOGO_SVG,
  darkenPdfPixel,
  paginatePdfText,
  pdfFooterText,
  pdfHeldNotice,
  pdfPageLabel,
  planWholePdfImage,
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

  it("preserves saved selection order instead of catalogue order", () => {
    const selected = new Set([questions[3].id, questions[0].id]);
    expect(questionsForPdf(questions, selected, true, questions)).toEqual([questions[3], questions[0]]);
  });

  it("caps a single worksheet before signing or downloading assets", () => {
    const manyQuestions = loadBankQuestions("ib-sl").slice(0, MAX_PDF_QUESTIONS + 5);
    expect(questionsForPdf(manyQuestions, new Set(), false)).toHaveLength(MAX_PDF_QUESTIONS);
  });

  it("adds an account-linked personal-use footer", () => {
    expect(pdfFooterText("A1B2C3D4")).toBe("PastPaperPrep • Account A1B2C3D4 • Personal study only");
    expect(pdfPageLabel(2, 7)).toBe("Page 2 of 7");
  });

  it("sets intrinsic SVG dimensions so the book mark is not rasterized with the browser's 2:1 default size", () => {
    expect(PDF_BOOK_LOGO_SVG).toContain('width="256" height="256" viewBox="0 0 256 256"');
  });


  it("lists every fit-to-page exception by exact question and image", () => {
    expect(pdfHeldNotice([
      { questionId: "q16", kind: "question", imageIndex: 0, reason: "fit-to-page", scale: 0.8 },
      { questionId: "q17", kind: "answer", imageIndex: 2, reason: "fit-to-page", scale: 0.7 },
    ])).toContain("q16 question image 1; q17 answer image 3");
  });

  it("prints a full-width 1.5x science crop on A4 at its inferred source point scale", () => {
    const placement = planWholePdfImage(893, 1113, undefined, false, 108);
    expect(placement.format).toBe("a4");
    expect(placement.orientation).toBe("portrait");
    expect(placement.widthMm).toBeCloseTo(210, 1);
    expect(placement.xMm).toBeCloseTo(0, 1);
    expect(placement.scale).toBe(1);
    expect(placement.heldReason).toBeNull();
  });

  it("uses a compact branded A4 header for a tall full-width science source page", () => {
    const placement = planWholePdfImage(893, 1128, undefined, false, 108);
    expect(placement.format).toBe("a4");
    expect(placement.scale).toBe(1);
    expect(placement.yMm).toBeLessThanOrEqual(10);
    expect(placement.yMm + placement.heightMm).toBeLessThanOrEqual(284);
  });

  it("uses the source page width for a 1.75x IB science raster rather than sending it to A3", () => {
    const placement = planWholePdfImage(1041, 1000, undefined, false, 126);
    expect(placement.format).toBe("a4");
    expect(placement.scale).toBe(1);
    expect(placement.widthMm).toBeGreaterThan(209);
    expect(placement.widthMm).toBeLessThanOrEqual(210);
  });

  it("keeps a full-width landscape practical mark scheme on A4 at source scale", () => {
    const placement = planWholePdfImage(1263, 758, undefined, false, 108);
    expect(placement.format).toBe("a4");
    expect(placement.orientation).toBe("landscape");
    expect(placement.widthMm).toBeCloseTo(297, 1);
    expect(placement.scale).toBe(1);
    expect(placement.yMm).toBeLessThanOrEqual(10);
  });

  it("keeps a short plain mark-scheme row on A4 with only the necessary under-5% reduction", () => {
    const placement = planWholePdfImage(918, 34, undefined, true, 108);
    expect(placement.format).toBe("a4");
    expect(placement.orientation).toBe("portrait");
    expect(placement.widthMm).toBeLessThanOrEqual(210);
    expect(placement.scale).toBeGreaterThanOrEqual(0.95);
    expect(placement.scale).toBeLessThan(1);
    expect(placement.heldReason).toBeNull();
  });

  it("keeps a tall unverified image whole on A4 and records fit-to-page instead of slicing ink rows", () => {
    const placement = planWholePdfImage(1070, 3082);
    expect(placement.format).toBe("a4");
    expect(placement.orientation).toBe("portrait");
    expect(placement.scale).toBeLessThan(1);
    expect(placement.heldReason).toBe("fit-to-page");
    expect(placement.yMm + placement.heightMm).toBeLessThanOrEqual(placement.pageHeightMm - 13);
  });

  it("fits an image slightly wider than the A4 print area onto A4 instead of sending it to A3", () => {
    // A3 "at original scale" prints at 71% on an A4 printer; fitting to A4 keeps it at about 96%.
    const placement = planWholePdfImage(1191, 1524);
    expect(placement.format).toBe("a4");
    expect(placement.scale).toBeCloseTo(194 / (1191 * 25.4 / 150), 4);
    expect(placement.heldReason).toBe("fit-to-page");
  });

  it("never chooses A3, even for an image far larger than A4", () => {
    for (const [w, h] of [[1070, 4479], [1630, 1941], [2400, 900]]) expect(planWholePdfImage(w, h).format).toBe("a4");
  });

  it("treats a 126-DPI landscape mark-scheme page one pixel over 297 mm as A4 landscape at source size", () => {
    const placement = planWholePdfImage(1474, 908, null, false, 126);
    expect(placement).toMatchObject({ format: "a4", orientation: "landscape", scale: 1, heldReason: null });
  });

  it("uses the compact header rather than shrinking a full exam page by a few percent", () => {
    const placement = planWholePdfImage(1070, 1575, [513, 755.55]);
    expect(placement).toMatchObject({ format: "a4", scale: 1, headerMode: "compact", heldReason: null });
  });

  it("keeps the 0580 Q16 graph intact at verified physical size on one A4 page", () => {
    const placement = planWholePdfImage(1070, 1531, [513, 734.33]);
    expect(placement.format).toBe("a4");
    expect(placement.scale).toBe(1);
    expect(placement.widthMm).toBeCloseTo(513 * 25.4 / 72, 4);
    expect(placement.heightMm).toBeCloseTo(734.33 * 25.4 / 72, 4);
    expect(placement.yMm + placement.heightMm).toBeLessThanOrEqual(284);
  });

  it("does not block absent geometry or an oversized verified image", () => {
    expect(planWholePdfImage(1070, 1531).scale).toBeLessThanOrEqual(1);
    const oversized = planWholePdfImage(1070, 3000, [513, 1300]);
    expect(oversized.heldReason).toBe("fit-to-page");
    expect(oversized.scale).toBeLessThan(1);
  });

  it("reserves the five-percent shrink option for explicitly plain text crops", () => {
    const protectedImage = planWholePdfImage(1070, 1531, [575, 567]);
    const plain = planWholePdfImage(1070, 1531, [575, 567], true);
    expect(protectedImage.heldReason).toBe("fit-to-page");
    expect(plain.heldReason).toBeNull();
    expect(plain.scale).toBeGreaterThanOrEqual(0.95);
    expect(plain.scale).toBeLessThanOrEqual(1);
  });

  it("never enlarges a small raster and rejects invalid dimensions", () => {
    expect(planWholePdfImage(200, 300).scale).toBe(1);
    expect(() => planWholePdfImage(0, 300)).toThrow(/dimensions must be positive/i);
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