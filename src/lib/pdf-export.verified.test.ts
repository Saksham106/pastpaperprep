import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedQuestion } from "@/lib/questions";
import { attachPdfAssetMetadata, downloadQuestionPdf } from "@/lib/pdf-export";

const { addImage, addPage, save } = vi.hoisted(() => ({
  addImage: vi.fn(), addPage: vi.fn(), save: vi.fn(),
}));
vi.mock("jspdf", () => ({ jsPDF: class {
  addImage = addImage; addPage = addPage; save = save;
  setProperties() {} setFont() {} setFontSize() {} setTextColor() {} text() {}
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
    originalImage = window.Image;
    window.Image = class {
      naturalWidth = 1070; naturalHeight = 1531; crossOrigin = "";
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      set src(value: string) {
        if (value.startsWith("data:image/svg")) { this.naturalWidth = 256; this.naturalHeight = 256; }
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

  it("packs two short intact source-size images on the same page", async () => {
    const short = { ...q16, questionPrintSizesPt: [[513, 100] as [number, number]], questionImages: ["https://signed.test/short.webp"] };
    await downloadQuestionPdf([short, { ...short, id: "q2", number: 2 }], "questions");
    const images = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(images).toHaveLength(2);
    expect(addPage).not.toHaveBeenCalled();
    expect(images[0][3]).toBe(22);
    expect(images[1][3]).toBeCloseTo(22 + 100 * 25.4 / 72 + 4, 3);
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
});
