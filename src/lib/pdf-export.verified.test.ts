import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedQuestion } from "@/lib/questions";
import { attachPdfAssetMetadata, downloadQuestionPdf } from "@/lib/pdf-export";
import approved from "@/data/reviewed-blank-tails-0606.json";

const { addImage, addPage, deletePage, save, verifyBytes, text, roundedRect } = vi.hoisted(() => ({
  addImage: vi.fn(), addPage: vi.fn(), deletePage: vi.fn(), save: vi.fn(), verifyBytes: vi.fn(), text: vi.fn(), roundedRect: vi.fn(),
}));
vi.mock("@/lib/verified-asset-bytes", () => ({ fetchVerifiedImageBlob: verifyBytes }));
vi.mock("jspdf", () => ({ jsPDF: class {
  addImage = addImage; addPage = addPage; deletePage = deletePage; save = save; roundedRect = roundedRect;
  setProperties() {} setFont() {} setFontSize() {} setTextColor() {} text = text;
  setPage() {} setDrawColor() {} setFillColor() {} setLineWidth() {} line() {} textWithLink() {}
  getTextWidth(value: string) { return value.length * 1.5; }
} }));

const q16 = {
  id: "0580-2025-november-11-q16", year: 2025, session: "November", paper: 1, number: 16,
  primaryTopic: "Graphs", subtopics: [],
  questionImages: ["https://signed.test/q16.webp"], markschemeImages: [], solution: null,
  questionPrintSizesPt: [[513, 734.33]],
} as unknown as UnifiedQuestion;

describe("real worksheet image placement", () => {
  let createElement: typeof document.createElement;
  let originalImage: typeof window.Image;
  beforeEach(() => {
    vi.clearAllMocks();
    verifyBytes.mockResolvedValue(new Blob(["verified-image"], { type: "image/webp" }));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:q11.webp") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    originalImage = window.Image;
    window.Image = class {
      naturalWidth = 1070; naturalHeight = 1531; crossOrigin = "";
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      set src(value: string) {
        if (value.startsWith("data:image/svg")) { this.naturalWidth = 256; this.naturalHeight = 256; }
        if (value.includes("q11.webp")) { this.naturalWidth = 1070; this.naturalHeight = 4501; }
        if (value.includes("tall.webp")) { this.naturalWidth = 1070; this.naturalHeight = 3082; }
        if (value.includes("science-full.webp")) { this.naturalWidth = 893; this.naturalHeight = 1128; }
        if (value.includes("science-answer-row.webp")) { this.naturalWidth = 918; this.naturalHeight = 34; }
        if (value.includes("wide-answer.webp")) { this.naturalWidth = 1630; this.naturalHeight = 1941; }
        if (value.includes("0580-q11.webp")) { this.naturalWidth = 1070; this.naturalHeight = 4479; }
        if (value.includes("middle-blank.webp")) { this.naturalWidth = 1070; this.naturalHeight = 4400; }
        if (value.includes("two-short-pages.webp")) { this.naturalWidth = 1070; this.naturalHeight = 1200; }
        queueMicrotask(() => this.onload?.(new Event("load")));
      }
    } as unknown as typeof window.Image;
    createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((name: string) => {
      if (name !== "canvas") return createElement(name);
      const canvas = { width: 0, height: 0, toDataURL: () => "data:image/jpeg;base64,AA==" };
      return Object.assign(canvas, { getContext: () => ({
        fillStyle: "#fff", fillRect() {}, drawImage() {}, putImageData() {},
        getImageData: () => ({ data: new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(255) }),
      }) }) as unknown as HTMLCanvasElement;
    }) as typeof document.createElement);
  });
  afterEach(() => { window.Image = originalImage; vi.restoreAllMocks(); });

  it("passes signer geometry to the real export question alongside its URL", () => {
    const signed = new Map([[`${q16.id}:question`, {
      questionId: q16.id, kind: "question" as const, urls: ["https://signed.test/q16.webp"],
      printSizesPt: [[513, 734.33] as [number, number]], expiresAt: Date.now() + 60_000,
    }]]);
    const prepared = attachPdfAssetMetadata([q16], signed);
    expect(prepared[0].questionImages).toEqual(["https://signed.test/q16.webp"]);
    expect(prepared[0].questionPrintSizesPt).toEqual([[513, 734.33]]);
  });

  it("draws source and marks labels above an image question without scaling it", async () => {
    const short = { ...q16, number: 1, marks: 3, questionPrintSizesPt: [[513, 100] as [number, number]] };
    await downloadQuestionPdf([short], "questions");
    expect(text.mock.calls.some(([value]) => value === "2025 November / Paper 11 / Q1")).toBe(true);
    expect(text.mock.calls.some(([value]) => value === "3 marks")).toBe(true);
    const image = addImage.mock.calls.find((call) => call[1] === "JPEG")!;
    expect(image[5]).toBeCloseTo(100 * 25.4 / 72, 4);
  });

  it("starts all-answers-last on a separately labelled page even when the last question leaves space", async () => {
    const short = { ...q16, number: 1, questionPrintSizesPt: [[513, 100] as [number, number]],
      markschemeImages: ["https://signed.test/answer.webp"], markschemePrintSizesPt: [[513, 60] as [number, number]] };
    await downloadQuestionPdf([short], "both");
    expect(addPage).toHaveBeenCalledTimes(1);
    expect(text.mock.calls.some(([value]) => value === "Answers")).toBe(true);
    expect(text.mock.calls.some(([value]) => value === "Official answer")).toBe(true);
  });

  it("retains the label when label plus image needs a fresh page", async () => {
    const first = { ...q16, number: 1, questionPrintSizesPt: [[513, 600] as [number, number]] };
    const second = { ...q16, id: "0580-2025-november-11-q2", number: 2,
      questionPrintSizesPt: [[513, 200] as [number, number]] };
    await downloadQuestionPdf([first, second], "questions");
    expect(addPage).toHaveBeenCalledTimes(1);
    expect(text.mock.calls.some(([value]) => value === "2025 November / Paper 11 / Q2")).toBe(true);
    const images = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(images[1][3]).toBe(27);
    expect(images[1][5]).toBeCloseTo(200 * 25.4 / 72, 4);
  });

  it("packs two short intact source-size images on the same page", async () => {
    const short = { ...q16, questionPrintSizesPt: [[513, 100] as [number, number]], questionImages: ["https://signed.test/short.webp"] };
    await downloadQuestionPdf([short, { ...short, id: "q2", number: 2 }], "questions");
    const images = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(images).toHaveLength(2);
    expect(addPage).not.toHaveBeenCalled();
    expect(images[0][3]).toBe(27);
    expect(images[1][3]).toBeCloseTo(27 + 100 * 25.4 / 72 + 4 + 5, 3);
  });

  it("places Q16 once at its verified physical size instead of slicing its graph", async () => {
    await downloadQuestionPdf([q16], "questions");
    const questionImages = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(questionImages).toHaveLength(1);
    expect(questionImages[0][2]).toBeCloseTo((210 - 513 * 25.4 / 72) / 2, 3);
    // A compact header leaves room for the question label above the full-size graph.
    expect(questionImages[0][3]).toBe(15);
    expect(text).toHaveBeenCalledWith(expect.stringMatching(/Q16$/), expect.any(Number), 13);
    expect(questionImages[0][4]).toBeCloseTo(513 * 25.4 / 72, 3);
    expect(questionImages[0][5]).toBeCloseTo(734.33 * 25.4 / 72, 3);
    expect(addPage).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledOnce();
  });

  it("downloads a full-width 0610 source crop at A4 point size instead of the 150-DPI 28% shrink", async () => {
    const science = { ...q16, id: "0610-2026-m-42-q2", bankSlug: "igcse-biology-0610" as const,
      questionImages: ["https://signed.test/science-full.webp"], questionPrintSizesPt: undefined } as unknown as UnifiedQuestion;
    const result = await downloadQuestionPdf([science], "questions");
    const images = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(images).toHaveLength(1);
    expect(images[0][2]).toBeCloseTo(0, 1);
    expect(images[0][3]).toBe(15);
    expect(images[0][4]).toBeCloseTo(210, 1);
    expect(result.heldRows).toEqual([]);
  });

  it("keeps a short 0610 answer row in the same A4 layout without rotating the paper", async () => {
    const science = { ...q16, id: "0610-2026-m-42-q2", bankSlug: "igcse-biology-0610" as const,
      questionImages: [], markschemeImages: ["https://signed.test/science-answer-row.webp"],
      markschemePrintSizesPt: undefined } as unknown as UnifiedQuestion;
    const result = await downloadQuestionPdf([science], "answers");
    const image = addImage.mock.calls.find((call) => call[1] === "JPEG")!;
    expect(image[2]).toBeCloseTo(0, 1);
    expect(image[4]).toBeCloseTo(210, 1);
    expect(addPage).not.toHaveBeenCalled();
    expect(result.heldRows).toEqual([]);
  });

  it("prints each exam page of a multi-page 0606 question at source size and drops its hash-verified BLANK PAGE", async () => {
    const stitched = {
      ...q16, bankSlug: "igcse-additional" as const, id: "0606-2016-june-13-q11", number: 11,
      questionImages: ["https://signed.test/q11.webp"],
      questionPrintSizesPt: [[513, 2159] as [number, number]],
      questionRasterSizesPx: [[1070, 4501] as [number, number]],
      questionPrintSegments: [[
        { sourceY: 0, sourceHeight: 1602, physicalHeightPt: 768.36, sourcePage: 14 },
        { sourceY: 1602, sourceHeight: 1551, physicalHeightPt: 743.98, sourcePage: 15 },
        { sourceY: 3153, sourceHeight: 1348, physicalHeightPt: 646.66, sourcePage: 16, include: false, imageSha256: approved.entries["0606-2016-june-13-q11"].imageSha256 },
      ]],
    };
    const result = await downloadQuestionPdf([stitched], "questions");
    const images = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    // Pages 14 and 15 each print at full size; the BLANK PAGE (16) is left out.
    expect(images).toHaveLength(2);
    expect(result.heldRows).toEqual([]);
    expect(images[1][4]).toBeCloseTo(513 * 25.4 / 72, 4);
    expect(images[1][5]).toBeCloseTo(743.98 * 25.4 / 72, 4);
    expect(addPage).toHaveBeenCalledTimes(1);
    // Page 14 is 271 mm tall; a ~1% reduction keeps its "Q11" label rather than dropping it.
    expect(text).toHaveBeenCalledWith(expect.stringMatching(/Q11$/), expect.any(Number), 13);
    expect(images[0][4] / (513 * 25.4 / 72)).toBeGreaterThan(0.99);
    expect(text).toHaveBeenCalledWith(expect.stringMatching(/Q11 \(continued\)$/), expect.any(Number), expect.any(Number));
    expect(verifyBytes).toHaveBeenCalledWith("https://signed.test/q11.webp", approved.entries["0606-2016-june-13-q11"].imageSha256);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:q11.webp");
  });

  it("refuses to save any PDF when the reviewed blank-tail image bytes have changed", async () => {
    verifyBytes.mockRejectedValueOnce(new Error("Verified image SHA-256 mismatch"));
    const source = {
      ...q16, bankSlug: "igcse-additional" as const, id: "0606-2016-june-13-q11", questionImages: ["https://signed.test/q11.webp"],
      questionPrintSizesPt: [[513, 2159] as [number, number]],
      questionRasterSizesPx: [[1070, 4501] as [number, number]],
      questionPrintSegments: [[
        { sourceY: 0, sourceHeight: 1602, physicalHeightPt: 768.36, sourcePage: 14 },
        { sourceY: 1602, sourceHeight: 1551, physicalHeightPt: 743.98, sourcePage: 15 },
        { sourceY: 3153, sourceHeight: 1348, physicalHeightPt: 646.66, sourcePage: 16,
          include: false, imageSha256: approved.entries["0606-2016-june-13-q11"].imageSha256 },
      ]],
    };
    await expect(downloadQuestionPdf([source], "questions")).rejects.toThrow("SHA-256 mismatch");
    expect(save).not.toHaveBeenCalled();
    expect(addImage.mock.calls.filter((call) => call[1] === "JPEG")).toHaveLength(0);
  });

  it("prints the whole 0606 image when signed geometry is absent instead of blocking export", async () => {
    const missing = { ...q16, id: "0606-2016-june-11-q1", bankSlug: "igcse-additional" as const,
      questionImages: ["https://signed.test/q1.webp"], questionPrintSizesPt: undefined } as unknown as UnifiedQuestion;
    const result = await downloadQuestionPdf([missing], "questions");
    expect(addImage.mock.calls.filter((call) => call[1] === "JPEG")).toHaveLength(1);
    expect(save).toHaveBeenCalledOnce();
    expect(result.heldRows).toEqual([]);
  });

  it("places an unverified tall image once on a page and records its fit-to-page exception", async () => {
    const tall = { ...q16, bankSlug: "ib-biology-hl" as const,
      questionImages: ["https://signed.test/tall.webp"], questionPrintSizesPt: undefined } as unknown as UnifiedQuestion;
    const result = await downloadQuestionPdf([tall], "questions");
    expect(addImage.mock.calls.filter((call) => call[1] === "JPEG")).toHaveLength(1);
    expect(result.heldRows).toEqual([expect.objectContaining({ questionId: tall.id, kind: "question", reason: "fit-to-page" })]);
    expect(save).toHaveBeenCalledOnce();
  });

  it("rejects an empty 0606 question image list even when another question rendered", async () => {
    const missing = { ...q16, id: "0606-2016-june-11-q1", bankSlug: "igcse-additional" as const,
      questionImages: [], questionPrintSizesPt: [], questionPrintSegments: [], questionRasterSizesPx: [] };
    await expect(downloadQuestionPdf([q16, missing], "questions")).rejects.toThrow(/question image is missing/i);
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects a missing 0606 official answer rather than exporting its text solution", async () => {
    const missing = { ...q16, id: "0606-2016-june-11-q1", bankSlug: "igcse-additional" as const,
      markschemeImages: [], solution: "Do not substitute text for official answers" };
    await expect(downloadQuestionPdf([missing], "answers")).rejects.toThrow(/official answer image is missing/i);
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects altered 0606 segment boundaries even if the image hash and total raster height agree", async () => {
    const altered = { ...q16, bankSlug: "igcse-additional" as const, id: "0606-2016-june-13-q11",
      questionImages: ["https://signed.test/q11.webp"],
      questionPrintSizesPt: [[513, 2159] as [number, number]],
      questionRasterSizesPx: [[1070, 4501] as [number, number]],
      questionPrintSegments: [[
        { sourceY: 0, sourceHeight: 1603, physicalHeightPt: 768.36, sourcePage: 14 },
        { sourceY: 1603, sourceHeight: 1550, physicalHeightPt: 743.98, sourcePage: 15 },
        { sourceY: 3153, sourceHeight: 1348, physicalHeightPt: 646.66, sourcePage: 16,
          include: false, imageSha256: approved.entries["0606-2016-june-13-q11"].imageSha256 },
      ]],
    };
    await expect(downloadQuestionPdf([altered], "questions")).rejects.toThrow(/verified source geometry/i);
    expect(save).not.toHaveBeenCalled();
  });

  it("prints a wide two-page official answer at source size on A4 landscape instead of A3", async () => {
    const wide = {
      ...q16, bankSlug: "igcse-additional" as const, id: "0606-2026-june-21-q5", number: 5,
      markschemeImages: ["https://signed.test/wide-answer.webp"],
      markschemePrintSizesPt: [[781.92, 930.59] as [number, number]],
      markschemeRasterSizesPx: [[1630, 1941] as [number, number]],
      markschemePrintSegments: [[
        { sourceY: 0, sourceHeight: 988, physicalHeightPt: 473.59, sourcePage: 13 },
        { sourceY: 988, sourceHeight: 953, physicalHeightPt: 457, sourcePage: 14 },
      ]],
    };
    const result = await downloadQuestionPdf([wide], "answers");
    const images = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(images).toHaveLength(2);
    expect(images.every((call) => Math.abs(call[4] - 781.92 * 25.4 / 72) < 1e-4)).toBe(true);
    expect(images.map((call) => call[5])).toEqual([expect.closeTo(473.59 * 25.4 / 72, 4), expect.closeTo(457 * 25.4 / 72, 4)]);
    expect(result.heldRows).toEqual([]);
    expect(addPage).not.toHaveBeenCalledWith("a3", expect.anything());
    expect(addPage).toHaveBeenCalledWith("a4", "landscape");
  });

  it("does not flag a full-page scan fitted to A4 at 90% for print review, but still flags a badly shrunk one", async () => {
    const page = { ...q16, bankSlug: "ib-sl" as const, questionImages: ["https://signed.test/science-full.webp"],
      questionPrintSizesPt: [[600, 760] as [number, number]] } as unknown as UnifiedQuestion;
    expect((await downloadQuestionPdf([page], "questions")).heldRows).toEqual([]);
    const tall = { ...q16, bankSlug: "ib-biology-hl" as const, questionImages: ["https://signed.test/tall.webp"], questionPrintSizesPt: undefined } as unknown as UnifiedQuestion;
    expect((await downloadQuestionPdf([tall], "questions")).heldRows).toHaveLength(1);
  });

  const q0580 = {
    ...q16, id: "0580-2024-june-43-q11", year: 2024, session: "May/June", paper: 4, component: "43", number: 11, marks: 9,
    questionImages: ["https://signed.test/0580-q11.webp"],
    questionPrintSizesPt: [[513, 2148.47] as [number, number]],
    questionRasterSizesPx: [[1070, 4479] as [number, number]],
    questionPrintSegments: [[
      { sourceY: 0, sourceHeight: 1533, physicalHeightPt: 735.43, sourcePage: 22 },
      { sourceY: 1533, sourceHeight: 1575, physicalHeightPt: 755.55, sourcePage: 23 },
      { sourceY: 3108, sourceHeight: 1371, physicalHeightPt: 657.49, sourcePage: 24, include: false,
        imageSha256: "d9019dbe02bcbd7beaa089dae81a933e429e10a164b2cf7719f96216710ed0e6" },
    ]],
  } as unknown as UnifiedQuestion;

  it("prints a solid NO CALCULATOR badge left of the marks on a non-calculator question", async () => {
    await downloadQuestionPdf([{ ...q16, marks: 6, calculator: false } as UnifiedQuestion], "questions");
    expect(text).toHaveBeenCalledWith("NO CALCULATOR", expect.any(Number), expect.any(Number));
    const [x, , width, , , , style] = roundedRect.mock.calls[0];
    expect(style).toBe("FD");
    const marksCall = text.mock.calls.find((call) => call[0] === "6 marks")!;
    expect(x + width).toBeLessThanOrEqual(marksCall[1] - "6 marks".length * 1.5);
  });

  it("prints an outlined CALCULATOR badge, and nothing for unknown status or on answer pages", async () => {
    await downloadQuestionPdf([{ ...q16, marks: 6, calculator: true } as UnifiedQuestion], "questions");
    expect(roundedRect.mock.calls[0][6]).toBe("S");
    expect(text).toHaveBeenCalledWith("CALCULATOR", expect.any(Number), expect.any(Number));
    roundedRect.mockClear();
    await downloadQuestionPdf([{ ...q16, marks: 6, calculator: null } as UnifiedQuestion], "questions");
    expect(roundedRect).not.toHaveBeenCalled();
    await downloadQuestionPdf([{ ...q16, calculator: false, markschemeImages: ["https://signed.test/q16.webp"] } as UnifiedQuestion], "answers");
    expect(roundedRect).not.toHaveBeenCalled();
  });

  it("repeats the badge on the continued part of a question split across pages", async () => {
    vi.mocked(URL.createObjectURL).mockReturnValue("blob:0580-q11.webp");
    await downloadQuestionPdf([{ ...q0580, calculator: false } as UnifiedQuestion], "questions");
    expect(text.mock.calls.filter((call) => call[0] === "NO CALCULATOR")).toHaveLength(2);
  });

  it("prints the reported 0580 2024 June 43 Q11 at full size instead of 36% (regression)", async () => {
    vi.mocked(URL.createObjectURL).mockReturnValue("blob:0580-q11.webp");
    const result = await downloadQuestionPdf([q0580], "questions");
    const images = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(images).toHaveLength(2);
    expect(result.heldRows).toEqual([]);
    expect(images.every((call) => Math.abs(call[4] - 513 * 25.4 / 72) < 1e-4)).toBe(true);
    expect(images.map((call) => call[5])).toEqual([expect.closeTo(735.43 * 25.4 / 72, 4), expect.closeTo(755.55 * 25.4 / 72, 4)]);
    expect(addPage).not.toHaveBeenCalledWith("a3", expect.anything());
    expect(verifyBytes).toHaveBeenCalledWith("https://signed.test/0580-q11.webp", "d9019dbe02bcbd7beaa089dae81a933e429e10a164b2cf7719f96216710ed0e6");
    expect(text).toHaveBeenCalledWith("9 marks", expect.any(Number), expect.any(Number), { align: "right" });
  });

  it("skips a BLANK PAGE in the middle of a question and keeps the pages either side", async () => {
    const middle = { ...q0580, id: "0580-2022-june-43-q10", questionImages: ["https://signed.test/middle-blank.webp"],
      questionPrintSizesPt: [[513, 2112] as [number, number]], questionRasterSizesPx: [[1070, 4400] as [number, number]],
      questionPrintSegments: [[
        { sourceY: 0, sourceHeight: 1500, physicalHeightPt: 720, sourcePage: 18 },
        { sourceY: 1500, sourceHeight: 1400, physicalHeightPt: 672, sourcePage: 19, include: false, imageSha256: "a".repeat(64) },
        { sourceY: 2900, sourceHeight: 1500, physicalHeightPt: 720, sourcePage: 20 },
      ]] } as unknown as UnifiedQuestion;
    vi.mocked(URL.createObjectURL).mockReturnValue("blob:middle-blank.webp");
    await downloadQuestionPdf([middle], "questions");
    const images = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(images.map((call) => call[5])).toEqual([expect.closeTo(720 * 25.4 / 72, 4), expect.closeTo(720 * 25.4 / 72, 4)]);
    expect(verifyBytes).toHaveBeenCalledWith("https://signed.test/middle-blank.webp", "a".repeat(64));
  });

  it("keeps a multi-page question as one image when it already fits A4 at source size", async () => {
    const short = { ...q0580, questionImages: ["https://signed.test/two-short-pages.webp"],
      questionPrintSizesPt: [[513, 576] as [number, number]], questionRasterSizesPx: [[1070, 1200] as [number, number]],
      questionPrintSegments: [[
        { sourceY: 0, sourceHeight: 600, physicalHeightPt: 288, sourcePage: 4 },
        { sourceY: 600, sourceHeight: 600, physicalHeightPt: 288, sourcePage: 5 },
      ]] } as unknown as UnifiedQuestion;
    await downloadQuestionPdf([short], "questions");
    const images = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(images).toHaveLength(1);
    expect(images[0][5]).toBeCloseTo(576 * 25.4 / 72, 4);
    expect(verifyBytes).not.toHaveBeenCalled();
  });
});
