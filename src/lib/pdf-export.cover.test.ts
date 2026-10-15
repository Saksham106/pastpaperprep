import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedQuestion } from "@/lib/questions";
import { downloadQuestionPdf } from "@/lib/pdf-export";

const { addImage, addPage, save, text, setPage, setFont, addFont, setProperties } = vi.hoisted(() => ({
  addImage: vi.fn(), addPage: vi.fn(), save: vi.fn(), text: vi.fn(), setPage: vi.fn(), setFont: vi.fn(), addFont: vi.fn(), setProperties: vi.fn(),
}));
vi.mock("jspdf", () => ({ jsPDF: class {
  addImage = addImage; addPage = addPage; save = save; text = text; setPage = setPage; setFont = setFont; addFont = addFont; setProperties = setProperties;
  deletePage() {} roundedRect() {} rect() {} addFileToVFS() {}
  setFontSize() {} setTextColor() {} setDrawColor() {} setFillColor() {} setLineWidth() {} line() {} textWithLink() {}
  getTextWidth(value: string) { return value.length * 1.5; }
  splitTextToSize(value: string, width: number) {
    const words = value.split(" "); const lines: string[] = []; let line = "";
    for (const word of words) { const next = line ? `${line} ${word}` : word; if (next.length * 1.5 > width && line) { lines.push(line); line = word; } else line = next; }
    return line ? [...lines, line] : lines;
  }
} }));

const base = {
  id: "0580-2024-june-22-q5", bankSlug: "igcse", year: 2024, session: "June", paper: 2, component: "22", number: 5, marks: 6,
  primaryTopic: "Algebra", subtopics: [], secondaryTopics: [], solution: null, markschemeImages: [],
  questionImages: ["https://signed.test/q.webp"],
};
const short = (overrides: Record<string, unknown> = {}) => ({ ...base, questionPrintSizesPt: [[513, 100]], ...overrides }) as unknown as UnifiedQuestion;
const fullPage = (overrides: Record<string, unknown> = {}) => ({ ...base, questionPrintSizesPt: [[513, 734.33]], ...overrides }) as unknown as UnifiedQuestion;
const cover = { title: "Algebra", bankSlug: "igcse" as const };
const drawn = (value: string) => text.mock.calls.some(([drawnValue]) => drawnValue === value);
const images = () => addImage.mock.calls.filter((call) => call[1] === "JPEG");

describe("PDF title block", () => {
  let createElement: typeof document.createElement;
  let originalImage: typeof window.Image;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0, 1, 0, 0]))));
    originalImage = window.Image;
    window.Image = class {
      naturalWidth = 1070; naturalHeight = 1531; crossOrigin = "";
      onload: ((event: Event) => void) | null = null;
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
  afterEach(() => { window.Image = originalImage; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("puts the title block above Question 1 on page 1 without scaling the question", async () => {
    await downloadQuestionPdf([short(), short({ id: "0580-2023-november-41-q3", year: 2023, session: "November", component: "41", paper: 4, number: 3, marks: 4, primaryTopic: "Graphs" })], "questions", undefined, undefined, undefined, cover);
    expect(addPage).not.toHaveBeenCalled();
    expect(drawn("IGCSE MATHEMATICS 0580 · EXTENDED")).toBe(true);
    expect(drawn("2 questions · 10 marks · 2023–2024")).toBe(true);
    expect(drawn("Question 1") && drawn("Question 2")).toBe(true);
    expect(drawn("2024 May/June · Paper 22 · Q5")).toBe(true);
    expect(drawn("/ 10")).toBe(true);
    expect(addFont).toHaveBeenCalledWith("YoungSerif-Regular.ttf", "YoungSerif", "normal");
    const first = images()[0];
    expect(first[3]).toBeGreaterThan(50);
    expect(first[5]).toBeCloseTo(100 * 25.4 / 72, 4);
    expect(setProperties).toHaveBeenCalledWith(expect.objectContaining({ title: "Algebra" }));
    expect(save).toHaveBeenCalledWith("mathematics-0580-algebra.pdf");
  });

  it("fills page 1 with a contents list when Question 1 cannot fit beneath the block", async () => {
    await downloadQuestionPdf([fullPage()], "questions", undefined, undefined, undefined, cover);
    expect(addPage).toHaveBeenCalledTimes(1);
    expect(images()[0][5]).toBeCloseTo(734.33 * 25.4 / 72, 3);
    expect(setPage).toHaveBeenCalledWith(1);
    expect(drawn("Contents")).toBe(true);
    expect(drawn("1")).toBe(true);
  });

  it("caps a long contents list above the footer", async () => {
    const questions = Array.from({ length: 50 }, (_, index) => fullPage({ id: `0580-2024-june-22-q${index + 1}`, number: index + 1 }));
    await downloadQuestionPdf(questions, "questions", undefined, undefined, undefined, cover);
    const more = text.mock.calls.find(([value]) => typeof value === "string" && /^\+ \d+ more$/.test(value));
    expect(more).toBeDefined();
    const contentsRows = text.mock.calls.filter(([value]) => typeof value === "string" && /^\d+$/.test(value));
    expect(contentsRows.length).toBeGreaterThan(10);
    expect(contentsRows.every(([, , y]) => y <= 278)).toBe(true);
    expect(Number(more![0].match(/\d+/)![0]) + contentsRows.length).toBe(50);
  });

  it("numbers mark-scheme-only exports and leaves out the score row", async () => {
    const answer = (number: number) => ({ ...short({ id: `0580-2024-june-22-q${number}`, number, questionImages: [] }), markschemeImages: ["https://signed.test/a.webp"], markschemePrintSizesPt: [[513, 60]] }) as unknown as UnifiedQuestion;
    await downloadQuestionPdf([answer(5), answer(9)], "answers", undefined, undefined, undefined, cover);
    expect(drawn("IGCSE MATHEMATICS 0580 · EXTENDED · MARK SCHEME")).toBe(true);
    expect(drawn("Question 2 · Mark scheme")).toBe(true);
    expect(drawn("Score")).toBe(false);
  });

  it("still exports in Helvetica when the title font cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await downloadQuestionPdf([short()], "questions", undefined, undefined, undefined, cover);
    expect(addFont).not.toHaveBeenCalled();
    expect(drawn("Algebra")).toBe(true);
    expect(save).toHaveBeenCalledOnce();
  });

  it("drops the grey source rather than overprint the marks and calculator badge on a narrow crop", async () => {
    await downloadQuestionPdf([short({ questionPrintSizesPt: [[150, 100]], calculator: false }), short({ id: "wide", number: 6 })], "questions");
    expect(drawn("Question 1") && drawn("6 marks")).toBe(true);
    expect(text.mock.calls.filter(([value]) => value === "2024 May/June · Paper 22 · Q5")).toHaveLength(0);
    expect(drawn("2024 May/June · Paper 22 · Q6")).toBe(true);
  });

  it("draws no title block without a cover", async () => {
    await downloadQuestionPdf([short()], "questions");
    expect(drawn("IGCSE MATHEMATICS 0580 · EXTENDED")).toBe(false);
    expect(images()[0][3]).toBe(27);
    expect(save).toHaveBeenCalledWith("pastpaperprep-questions.pdf");
  });
});
