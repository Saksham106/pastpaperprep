import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import runtimeJson from "@/data/production/cbse-12-chemistry.json";
import sizesJson from "@/data/image-sizes/cbse-12-chemistry.json";
import { downloadQuestionPdf, type PdfExportQuestion } from "@/lib/pdf-export";
import { imageSizeLookup, type EncodedImageSizes } from "@/lib/image-sizes";
import { buildMcqAnswerMap } from "@/lib/mcq-answer-letters";
import { normalizeBankQuestions } from "@/lib/questions";

// The real export path on real CBSE Class 12 Chemistry rows and their real crop sizes; only jsPDF and the browser
// image/canvas are stubbed (as in pdf-export.verified.test.ts). Saving a PDF needs paid access, so the signed-in
// visual check is left to an account that has it.
const { addImage, addPage, deletePage, save, verifyBytes, text, roundedRect } = vi.hoisted(() => ({
  addImage: vi.fn(), addPage: vi.fn(), deletePage: vi.fn(), save: vi.fn(), verifyBytes: vi.fn(), text: vi.fn(), roundedRect: vi.fn(),
}));
vi.mock("@/lib/verified-asset-bytes", () => ({ fetchVerifiedImageBlob: verifyBytes }));
vi.mock("jspdf", () => ({ jsPDF: class {
  addImage = addImage; addPage = addPage; deletePage = deletePage; save = save; roundedRect = roundedRect;
  setProperties() {} setFont() {} setFontSize() {} setTextColor() {} text = text;
  setPage() {} setDrawColor() {} setFillColor() {} setLineWidth() {} line() {} textWithLink() {}
  getTextWidth(value: string) { return value.length * 1.5; }
  splitTextToSize(value: string) { return [value]; }
} }));

const slug = "cbse-12-chemistry";
const rows = (runtimeJson as unknown as { questions: Array<Record<string, unknown> & { id: string }> }).questions;
const sizeOf = imageSizeLookup(sizesJson as unknown as EncodedImageSizes);
const PREFIX = (sizesJson as unknown as { prefix: string }).prefix;
const answers = buildMcqAnswerMap(slug, rows);
/** A row as the signer hands it to the exporter: delivered paths as URLs, an MCQ letter instead of the scheme crop. */
function exportRow(id: string): PdfExportQuestion {
  const [question] = normalizeBankQuestions(slug, [rows.find((row) => row.id === id)!]);
  const mcqAnswer = answers.get(id);
  const raw = rows.find((row) => row.id === id) as unknown as { questionImages: string[]; markschemeImages: string[] };
  return { ...question, questionImages: raw.questionImages.map((path) => `https://signed.test/${PREFIX}${path}`), markschemeImages: mcqAnswer ? [] : raw.markschemeImages.map((path) => `https://signed.test/${PREFIX}${path}`), ...(mcqAnswer ? { mcqAnswer } : {}) } as PdfExportQuestion;
}

describe("CBSE Class 12 Chemistry worksheet PDF", () => {
  let createElement: typeof document.createElement;
  let originalImage: typeof window.Image;
  beforeEach(() => {
    vi.clearAllMocks();
    verifyBytes.mockResolvedValue(new Blob(["verified-image"], { type: "image/webp" }));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn((blob: Blob & { url?: string }) => blob.url ?? "blob:crop") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    verifyBytes.mockImplementation(async (url: string) => Object.assign(new Blob(["verified-image"], { type: "image/webp" }), { url }));
    originalImage = window.Image;
    window.Image = class {
      naturalWidth = 256; naturalHeight = 256; crossOrigin = "";
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      set src(value: string) {
        const size = value.startsWith("https://signed.test/") ? sizeOf(value.slice("https://signed.test/".length)) : null;
        if (size) { this.naturalWidth = size[0]; this.naturalHeight = size[1]; }
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

  it("cites each question by its set and prints the crops at 1.5 px/pt (108 dpi)", async () => {
    const question = exportRow("cbse12c-2023-m-151-q16");
    await downloadQuestionPdf([question], "questions", undefined, undefined, undefined, { title: "Chemical Kinetics", bankSlug: slug });
    expect(text.mock.calls.some(([value]) => value === "2023 Main · Set 56/5/1 · Q16")).toBe(true);
    const first = sizeOf(`${PREFIX}questions/cbse12c-2023-m-151/q16-9-1.webp`)!;
    const placed = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(placed).toHaveLength(2);
    expect(placed[0][4]).toBeCloseTo(first[0] * 25.4 / 108, 3);
    expect(text.mock.calls.some(([value]) => typeof value === "string" && /CBSE Class 12 Chemistry/i.test(value))).toBe(true);
  });

  it("prints a settled two-letter key as both letters, and a no-key item's scheme crop", async () => {
    await downloadQuestionPdf([exportRow("cbse12c-2023-m-151-q16"), exportRow("cbse12c-2023-m-111-q6")], "answers");
    expect(text.mock.calls.some(([value]) => value === "A or B")).toBe(true);
    // The "full marks for any option" item has no letter: its answer page is the scheme's own line.
    const scheme = sizeOf(`${PREFIX}markschemes/cbse12c-2023-m-111/q6-3-1.webp`)!;
    const placed = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(placed).toHaveLength(1);
    expect(placed[0][4]).toBeCloseTo(scheme[0] * 25.4 / 108, 3);
    expect(text.mock.calls.some(([value]) => value === "2023 Main · Set 56/1/1 · Q6")).toBe(true);
  });
});
