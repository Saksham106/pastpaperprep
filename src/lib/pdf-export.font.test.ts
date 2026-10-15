// Real jsPDF and the real committed Young Serif TTF: no jsPDF mock, so font registration,
// glyph measurement and the fallbacks are exercised as they run in the browser.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import { downloadQuestionPdf } from "@/lib/pdf-export";
import type { UnifiedQuestion } from "@/lib/questions";

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const fontBytes = readFileSync(join(process.cwd(), "public", "fonts", "YoungSerif-Regular.ttf"));
const mcq = (number: number) => ({
  id: `0620-2025-m-12-q${number}`, bankSlug: "igcse-chemistry-0620", year: 2025, session: "March", paper: 1, component: "12", number, marks: 1,
  primaryTopic: "Atoms", subtopics: [], secondaryTopics: [], solution: null, questionImages: [], markschemeImages: [],
  mcqAnswer: { answers: ["B"], note: null },
}) as unknown as UnifiedQuestion;

let output = "";
let saved = "";
const canvasText: string[] = [];

async function exportWith(title: string, fontResponse: () => Response) {
  vi.stubGlobal("fetch", vi.fn(async () => fontResponse()));
  await downloadQuestionPdf([mcq(1), mcq(2)], "answers", undefined, undefined, undefined, { title, bankSlug: "igcse-chemistry-0620" });
}
const imageCount = () => (output.match(/\/Subtype \/Image/g) ?? []).length;

describe("PDF title font with real jsPDF", () => {
  let createElement: typeof document.createElement;
  let originalImage: typeof window.Image;
  beforeEach(() => {
    output = ""; saved = ""; canvasText.length = 0;
    (jsPDF.API as unknown as { save: (file: string) => void }).save = function (this: jsPDF, file: string) { saved = file; output = this.output(); };
    originalImage = window.Image;
    window.Image = class {
      naturalWidth = 1; naturalHeight = 1; crossOrigin = "";
      onload: ((event: Event) => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.(new Event("load"))); }
    } as unknown as typeof window.Image;
    createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((name: string) => {
      if (name !== "canvas") return createElement(name);
      const context = {
        font: "", fillStyle: "", textBaseline: "", fillRect() {}, drawImage() {}, scale() {},
        measureText: (text: string) => ({ width: [...text].length * 40, actualBoundingBoxAscent: 60, actualBoundingBoxDescent: 18 }),
        fillText: (text: string) => { canvasText.push(text); },
      };
      return { width: 0, height: 0, toDataURL: () => PNG_1PX, getContext: () => context } as unknown as HTMLCanvasElement;
    }) as typeof document.createElement);
  });
  afterEach(() => { window.Image = originalImage; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("sets a Latin title in the embedded Young Serif", async () => {
    await exportWith("Atoms revision", () => new Response(fontBytes));
    expect(saved).toBe("chemistry-0620-atoms-revision.pdf");
    expect(output).toContain("YoungSerif");
    expect(canvasText).toEqual([]);
  });

  it("draws a title Young Serif cannot spell as an image, so no character is lost", async () => {
    await exportWith("α + β revision", () => new Response(fontBytes));
    expect(canvasText.join(" ")).toBe("α + β revision");
    expect(imageCount()).toBeGreaterThan(0);
    await exportWith("细胞生物学复习", () => new Response(fontBytes));
    expect(canvasText.join("")).toContain("细胞生物学复习");
  });

  it("still saves when the font URL answers 200 with something that is not a font", async () => {
    await exportWith("Atoms revision", () => new Response("<!doctype html>not a font", { status: 200 }));
    expect(saved).toBe("chemistry-0620-atoms-revision.pdf");
    expect(output).toContain("(Atoms revision) Tj");
  });

  it("falls back to an image, not Helvetica, for a non-Latin title when the font is missing", async () => {
    await exportWith("α revision", () => new Response("missing", { status: 404 }));
    expect(saved).not.toBe("");
    expect(canvasText.join(" ")).toBe("α revision");
  });
});
