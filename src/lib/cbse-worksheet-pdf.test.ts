import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import scienceJson from "@/data/production/cbse-10-science.json";
import physicsJson from "@/data/production/cbse-12-physics.json";
import biologyJson from "@/data/production/cbse-12-biology.json";
import scienceSizes from "@/data/image-sizes/cbse-10-science.json";
import physicsSizes from "@/data/image-sizes/cbse-12-physics.json";
import biologySizes from "@/data/image-sizes/cbse-12-biology.json";
import { downloadQuestionPdf, type PdfExportQuestion } from "@/lib/pdf-export";
import { imageSizeLookup, type EncodedImageSizes } from "@/lib/image-sizes";
import { buildMcqAnswerMap } from "@/lib/mcq-answer-letters";
import { normalizeBankQuestions } from "@/lib/questions";
import type { BankSlug } from "@/lib/banks";

// The real export path on real CBSE Science, Physics and Biology rows and crop sizes; only jsPDF and the browser image and
// canvas are stubbed (as in pdf-export.verified.test.ts). Saving a PDF needs paid access, so a signed-in visual check is
// left to an account that has it.
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

type Rows = Array<Record<string, unknown> & { id: string; questionImages: string[]; markschemeImages: string[] }>;
const BANKS: Record<string, { rows: Rows; sizes: EncodedImageSizes }> = {
  "cbse-10-science": { rows: (scienceJson as unknown as { questions: Rows }).questions, sizes: scienceSizes as unknown as EncodedImageSizes },
  "cbse-12-physics": { rows: (physicsJson as unknown as { questions: Rows }).questions, sizes: physicsSizes as unknown as EncodedImageSizes },
  "cbse-12-biology": { rows: (biologyJson as unknown as { questions: Rows }).questions, sizes: biologySizes as unknown as EncodedImageSizes },
};
const sizeOf = (path: string) => {
  for (const { sizes } of Object.values(BANKS)) { const size = imageSizeLookup(sizes)(path); if (size) return size; }
  return null;
};
/** A row as the signer hands it to the exporter: delivered paths as URLs, an MCQ letter instead of the scheme crop. */
function exportRow(bank: BankSlug, id: string): PdfExportQuestion {
  const { rows, sizes } = BANKS[bank];
  const raw = rows.find((row) => row.id === id)!;
  const [question] = normalizeBankQuestions(bank, [raw]);
  const mcqAnswer = buildMcqAnswerMap(bank, [raw]).get(id);
  const url = (path: string) => `https://signed.test/${sizes.prefix}${path}`;
  return { ...question, questionImages: raw.questionImages.map(url), markschemeImages: mcqAnswer ? [] : raw.markschemeImages.map(url), ...(mcqAnswer ? { mcqAnswer } : {}) } as PdfExportQuestion;
}
const texts = () => text.mock.calls.map(([value]) => value as unknown);

describe("CBSE worksheet PDFs on real rows", () => {
  let createElement: typeof document.createElement;
  let originalImage: typeof window.Image;
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("Physics: a disputed key prints CBSE's letter with the owner-approved note; a 'no option correct' item prints its scheme line", async () => {
    await downloadQuestionPdf([exportRow("cbse-12-physics", "cbse12p-2023-m-121-q5"), exportRow("cbse-12-physics", "cbse12p-2023-m-112-q4")], "answers");
    expect(texts()).toContain("B");
    expect(texts()).toContainEqual(["CBSE's marking scheme gives (B). The physics suggests (A): the electric attraction between the beams is far stronger than their magnetic repulsion, so they attract."]);
    expect(texts()).toContain("2023 Main · Set 55/1/2 · Q4");
    const scheme = sizeOf("cbse-12-physics/releases/full1624-v1-d2e3683c8e1d/markschemes/cbse12p-2023-m-112/q4-3-1.webp");
    const placed = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(placed).toHaveLength(1);
    expect(scheme).not.toBeNull();
    expect(placed[0][4]).toBeCloseTo(scheme![0] * 25.4 / 108, 3);
  });

  it("Science: cites the set, and prints the questions at 1.5 px/pt", async () => {
    const id = "cbse10s-2023-m-111-q1";
    await downloadQuestionPdf([exportRow("cbse-10-science", id)], "questions");
    const row = BANKS["cbse-10-science"].rows.find((question) => question.id === id)!;
    expect(texts()).toContain(`2023 Main · Set ${row.zone as string} · Q1`);
    const first = sizeOf(`${BANKS["cbse-10-science"].sizes.prefix}${row.questionImages[0]}`)!;
    const placed = addImage.mock.calls.filter((call) => call[1] === "JPEG");
    expect(placed[0][4]).toBeCloseTo(first[0] * 25.4 / 108, 3);
  });

  it("Biology: a settled three-letter key prints every letter", async () => {
    await downloadQuestionPdf([exportRow("cbse-12-biology", "cbse12b-2023-m-132-q6")], "answers");
    expect(texts()).toContain("A, B or C");
  });
});
