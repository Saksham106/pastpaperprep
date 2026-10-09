import { describe, expect, it } from "vitest";
import source0580 from "@/data/print-geometry-0580.json";
import raw from "@/data/raw/igcse.json";
import { planWholePdfImage } from "@/lib/pdf-export";
import { printGeometryForSignedAssets } from "@/lib/print-geometry";

type Entry = [string, string, number, number, number, number, [number, number, number, number, 0 | 1][]];
const entries = source0580.entries as unknown as Record<string, [Entry | null, Entry | null]>;

describe("verified 0580 worksheet geometry", () => {
  it("covers every image the 0580 runtime can export", () => {
    const questions = (raw as unknown as { questions: Array<{ id: string; questionImages: string[]; markschemeImages?: string[] }> }).questions;
    for (const question of questions) {
      for (const [kind, paths] of [["question", question.questionImages], ["answer", question.markschemeImages ?? []]] as const) {
        const signed = printGeometryForSignedAssets("igcse", question.id, kind, paths);
        expect(signed.printSegments.every(Boolean), `${question.id} ${kind}`).toBe(true);
      }
    }
  });

  it("prints every kept exam page of every 0580 crop on A4 at source size", () => {
    let pages = 0;
    let hidden = 0;
    const shrunk: string[] = [];
    for (const [questionId, pair] of Object.entries(entries)) {
      for (const [index, entry] of pair.entries()) {
        if (!entry) continue;
        const [path, , widthPx, heightPx, widthPt, heightPt, segments] = entry;
        const signed = printGeometryForSignedAssets("igcse", questionId, index === 0 ? "question" : "answer", [path]);
        expect(signed.rasterSizesPx[0]).toEqual([widthPx, heightPx]);
        expect(signed.printSizesPt[0]).toEqual([widthPt, heightPt]);
        expect(segments.reduce((covered, [, height]) => covered + height, 0)).toBe(heightPx);
        for (const [, sourceHeight, physicalHeightPt, , include] of segments) {
          if (!include) { hidden += 1; continue; }
          const placement = planWholePdfImage(widthPx, sourceHeight, [widthPt, physicalHeightPt]);
          expect(placement.format).toBe("a4");
          if (placement.scale < 1) shrunk.push(`${widthPx} ${placement.scale.toFixed(3)}`);
          pages += 1;
        }
      }
    }
    expect(hidden).toBe(151);
    expect(pages).toBeGreaterThan(9000);
    // Only the 1152 px crops of 2020 November 43 (slightly wider than the A4 print area) may shrink, by under 1%.
    expect(shrunk.every((row) => row.startsWith("1152 ") && Number(row.split(" ")[1]) >= 0.99)).toBe(true);
  });

  it("returns the reported 0580 2024 June 43 Q11 as two printable pages plus its hash-bound BLANK PAGE", () => {
    const signed = printGeometryForSignedAssets("igcse", "0580-2024-june-43-q11", "question", ["questions/0580-2024-june-43-q11.webp"]);
    expect(signed.printSizesPt[0]).toEqual([513, 2148.47]);
    expect(signed.rasterSizesPx[0]).toEqual([1070, 4479]);
    expect(signed.printSegments[0]).toEqual([
      { sourceY: 0, sourceHeight: 1533, physicalHeightPt: 735.43, sourcePage: 22 },
      { sourceY: 1533, sourceHeight: 1575, physicalHeightPt: 755.55, sourcePage: 23 },
      { sourceY: 3108, sourceHeight: 1371, physicalHeightPt: 657.49, sourcePage: 24, include: false,
        imageSha256: "d9019dbe02bcbd7beaa089dae81a933e429e10a164b2cf7719f96216710ed0e6" },
    ]);
  });

  it("refuses geometry for a path the source receipt does not describe", () => {
    const signed = printGeometryForSignedAssets("igcse", "0580-2024-june-43-q11", "question", ["questions/0580-2024-june-43-q11-repaired.webp"]);
    expect(signed).toEqual({ printSizesPt: [null], printSegments: [null], rasterSizesPx: [null] });
  });
});
