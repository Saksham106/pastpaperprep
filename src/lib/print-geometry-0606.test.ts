import { describe, expect, it } from "vitest";
import source0606 from "@/data/print-geometry-0606.json";
import addition0606 from "@/data/print-geometry-0606-2026-march.json";
import { ADDED_0606_QUESTION_IDS } from "@/lib/igcse-0606-additions.mjs";
import { planWholePdfImage } from "@/lib/pdf-export";
import { printGeometryForSignedAssets } from "@/lib/print-geometry";

describe("verified 0606 full-bank worksheet geometry", () => {
  it("joins and physically fits every source-backed QP and MS image without resizing or arbitrary slicing", () => {
    // Historical 1,633-pair receipt is unchanged; the reviewed 2026 March addition is a separate,
    // non-overlapping file covering exactly the 23 added questions.
    expect(Object.keys(source0606.entries)).toHaveLength(1633);
    expect(Object.keys(addition0606.entries).sort()).toEqual([...ADDED_0606_QUESTION_IDS].sort());
    expect(Object.keys(addition0606.entries).filter((id) => id in source0606.entries)).toEqual([]);
    const entries = [...Object.entries(source0606.entries), ...Object.entries(addition0606.entries)];
    let tested = 0;
    let omitted = 0;
    for (const [questionId, pair] of entries) {
      for (const [index, value] of pair.entries()) {
        const kind = index === 0 ? "question" : "answer";
        const path = `${kind === "question" ? "questions" : "markschemes"}/${questionId}.webp`;
        const signed = printGeometryForSignedAssets("igcse-additional", questionId, kind, [path]);
        expect(signed.printSizesPt[0]).toEqual(value.physicalSizePt);
        expect(signed.rasterSizesPx[0]).toEqual(value.imageDimensions);
        const [width, height] = value.imageDimensions;
        const placement = planWholePdfImage(width, height, [value.physicalSizePt[0], value.physicalSizePt[1]]);
        expect(placement.scale).toBeGreaterThan(0);
        expect(placement.scale).toBeLessThanOrEqual(1);
        expect(placement.yMm + placement.heightMm).toBeLessThanOrEqual(placement.pageHeightMm - 13 + 0.001);
        expect(signed.printSegments[0]!.reduce((covered, part) => covered + part.sourceHeight, 0)).toBe(height);
        if (placement.scale === 1) {
          expect(placement.widthMm).toBeCloseTo(value.physicalSizePt[0] * 25.4 / 72, 6);
        }
        omitted += signed.printSegments[0]!.filter((part) => part.include === false).length;
        tested += 1;
      }
    }
    expect(tested).toBe(3312);
    expect(omitted).toBe(19);
  });
});
