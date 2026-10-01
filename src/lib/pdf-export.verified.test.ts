import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedQuestion } from "@/lib/questions";
import { attachPdfAssetMetadata, downloadQuestionPdf } from "@/lib/pdf-export";
import approved from "@/data/reviewed-blank-tails-0606.json";

const { addImage, addPage, deletePage, save, verifyBytes, text } = vi.hoisted(() => ({
  addImage: vi.fn(), addPage: vi.fn(), deletePage: vi.fn(), save: vi.fn(), verifyBytes: vi.fn(), text: vi.fn(),
}));
vi.mock("@/lib/verified-asset-bytes", () => ({ fetchVerifiedImageBlob: verifyBytes }));
vi.mock("jspdf", () => ({ jsPDF: class {
  addImage = addImage; addPage = addPage; deletePage = deletePage; save = save;
  setProperties() {} setFont() {} setFontSize() {} setTextColor() {} text = text;
  setPage() {} setDrawColor() {} line() {} textWithLink() {}
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
    expect(questionImages[0][3]).toBe(22);
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

  it("places Q11 as one complete image after removing only its hash-verified BLANK PAGE tail", async () => {
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
    expect(images).toHaveLength(1);
    expect(result.heldRows).toEqual([expect.objectContaining({ questionId: stitched.id, reason: "fit-to-page" })]);
    expect(images[0][4]).toBeLessThan(513 * 25.4 / 72);
    expect(images[0][5]).toBeLessThan(420 - 22 - 13);
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

  it("prints a wide official answer once on A3 at source physical size", async () => {
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
    expect(images).toHaveLength(1);
    expect(images[0][4]).toBeCloseTo(781.92 * 25.4 / 72, 4);
    expect(images[0][5]).toBeCloseTo(930.59 * 25.4 / 72, 4);
    expect(result.heldRows).toEqual([]);
    expect(addPage).toHaveBeenCalledWith("a3", "portrait");
    expect(deletePage).toHaveBeenCalledWith(1);
  });
});
