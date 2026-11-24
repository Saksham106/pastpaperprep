import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedQuestion } from "@/lib/questions";
import { downloadQuestionPdf, orderPdfJobs, sharedStimulusSkips } from "@/lib/pdf-export";

const { addImage, addPage, save, text, setPage, setFont, addFont, setProperties } = vi.hoisted(() => ({
  addImage: vi.fn(), addPage: vi.fn(), save: vi.fn(), text: vi.fn(), setPage: vi.fn(), setFont: vi.fn(), addFont: vi.fn(), setProperties: vi.fn(),
}));
vi.mock("jspdf", () => ({ jsPDF: class {
  addImage = addImage; addPage = addPage; save = save; text = text; setPage = setPage; setFont = setFont; addFont = addFont; setProperties = setProperties;
  deletePage() {} roundedRect() {} rect() {} addFileToVFS() {}
  setFontSize() {} setTextColor() {} setDrawColor() {} setFillColor() {} setLineWidth() {} line() {} textWithLink() {}
  getTextWidth(value: string) { return value.length * 1.5; }
  splitTextToSize(value: string) { return [value]; }
} }));

type Row = { id: string; bankSlug: string; stimulusId?: string; stimulusImageCount?: number };
const row = (id: string, stimulusId?: string, bankSlug = "ib-business-management-hl"): Row => ({ id, bankSlug, ...(stimulusId ? { stimulusId, stimulusImageCount: 2 } : {}) });
const skips = (rows: Row[], content: "questions" | "answers" | "both" = "questions", placement: "all-answers-last" | "after-each-question" = "all-answers-last") =>
  Object.fromEntries(sharedStimulusSkips(orderPdfJobs(rows, content, placement)));

describe("shared case study in worksheet PDFs: which images a question leaves out", () => {
  it("prints the case once, before the first of consecutive questions that share it", () => {
    expect(skips([row("a", "case-1"), row("b", "case-1"), row("c", "case-1")])).toEqual({ b: 2, c: 2 });
  });
  it("prints a case again when another question or another case comes between", () => {
    expect(skips([row("a", "case-1"), row("x"), row("b", "case-1")])).toEqual({});
    expect(skips([row("a", "case-1"), row("b", "case-2"), row("c", "case-2"), row("d", "case-1")])).toEqual({ c: 2 });
  });
  it("never shares a case across banks that reuse an id", () => {
    expect(skips([row("a", "case-1", "ib-business-management-hl"), row("b", "case-1", "ib-business-management-sl")])).toEqual({});
  });
  it("reprints the case when answers sit between the questions, so each question stands alone", () => {
    expect(skips([row("a", "case-1"), row("b", "case-1")], "both", "after-each-question")).toEqual({});
    expect(skips([row("a", "case-1"), row("b", "case-1")], "both", "all-answers-last")).toEqual({ b: 2 });
  });
  it("leaves questions without a case study untouched", () => {
    expect(skips([row("a"), row("b")])).toEqual({});
  });
});

describe("worksheet PDF with a shared case study", () => {
  let createElement: typeof document.createElement;
  let originalImage: typeof window.Image;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0, 1, 0, 0]))));
    originalImage = window.Image;
    window.Image = class {
      naturalWidth = 791; naturalHeight = 200; crossOrigin = "";
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

  const question = (number: number, caseId: string | null) => ({
    id: `ibbm-2024-may-hlsl-p1-tz1-q${number}`, bankSlug: "ib-business-management-hl", year: 2024, session: "May", paper: 1, component: "P1", number, marks: 2,
    primaryTopic: "Unit 1: Introduction to business management", subtopics: [], secondaryTopics: [], solution: null, markschemeImages: [],
    questionImages: [...(caseId ? [`https://signed.test/${caseId}-1.webp`, `https://signed.test/${caseId}-2.webp`] : []), `https://signed.test/q${number}.webp`],
    ...(caseId ? { stimulusId: caseId, stimulusImageCount: 2 } : {}),
  }) as unknown as UnifiedQuestion;
  const drawnImages = () => addImage.mock.calls.filter((call) => call[1] === "JPEG").length;

  it("prints the case study once for three questions that share it", async () => {
    await downloadQuestionPdf([question(1, "case"), question(2, "case"), question(3, "case")], "questions");
    // 2 case crops once + 3 question crops, not 3 x 3.
    expect(drawnImages()).toBe(5);
  });
  it("prints each case study once per run and a question without one as itself", async () => {
    await downloadQuestionPdf([question(1, "a"), question(2, "a"), question(3, "b"), question(4, "b"), question(5, null)], "questions");
    // case a once (2) + two question crops, case b once (2) + two question crops, then the plain question.
    expect(drawnImages()).toBe(2 + 2 + 2 + 2 + 1);
  });
  it("keeps the case above every question when answers follow each question", async () => {
    await downloadQuestionPdf([question(1, "case"), question(2, "case")], "both", undefined, undefined, "after-each-question");
    expect(drawnImages()).toBe(6);
  });
  it("never drops the question's own crop even if the case count were as long as the image list", async () => {
    const odd = { ...question(2, "case"), stimulusImageCount: 3 } as unknown as UnifiedQuestion;
    await downloadQuestionPdf([question(1, "case"), odd], "questions");
    expect(drawnImages()).toBe(3 + 1);
  });
});
