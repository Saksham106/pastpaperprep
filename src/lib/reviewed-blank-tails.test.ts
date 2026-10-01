import { describe, expect, it } from "vitest";
import approved from "@/data/reviewed-blank-tails-0606.json";
import { reviewedBlankTailForSignedAsset } from "@/lib/reviewed-blank-tails";
import { printGeometryForSignedAssets } from "@/lib/print-geometry";
import { planWholePdfImage } from "@/lib/pdf-export";

describe("visually reviewed 0606 source furniture", () => {
  it("matches exactly 19 source-backed final blank pages, not entire images or unrelated paths", () => {
    const entries = Object.entries(approved.entries);
    expect(entries).toHaveLength(19);
    for (const [qid, entry] of entries) {
      expect(reviewedBlankTailForSignedAsset("igcse-additional", qid, "question", entry.path))
        .toEqual({ imageSha256: entry.imageSha256, fullWidthPx: entry.rasterSizePx[0], fullHeightPx: entry.rasterSizePx[1], visibleHeightPx: entry.visibleHeightPx });
      expect(reviewedBlankTailForSignedAsset("igcse-additional", qid, "question", `questions/${qid}-wrong.webp`)).toBeNull();
      expect(reviewedBlankTailForSignedAsset("igcse-additional", qid, "answer", entry.path)).toBeNull();
    }
  });

  it("omits only the reviewed last BLANK PAGE in Q11, preserving every question pixel before it", () => {
    const id = "0606-2016-june-13-q11";
    const geometry = printGeometryForSignedAssets("igcse-additional", id, "question", [`questions/${id}.webp`]);
    const parts = geometry.printSegments[0]!;
    expect(parts.map((segment) => segment.include)).toEqual([undefined, undefined, false]);
    expect(parts[2].imageSha256).toBe(approved.entries[id].imageSha256);
    const [width, height] = geometry.rasterSizesPx[0]!;
    expect(parts.reduce((sum, part) => sum + part.sourceHeight, 0)).toBe(height);
    const visibleHeight = parts[2].sourceY;
    const sourceSize = geometry.printSizesPt[0]!;
    const placement = planWholePdfImage(width, visibleHeight,
      [sourceSize[0], sourceSize[1] - parts[2].physicalHeightPt]);
    expect(visibleHeight).toBe(3153);
    expect(placement.heldReason).toBe("fit-to-page");
  });
});
