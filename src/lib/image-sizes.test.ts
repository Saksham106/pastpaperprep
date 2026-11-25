import { describe, expect, it } from "vitest";
import { encodeImageSizes, encodeQuestionShapes, imageSizeLookup, mergeMeasuredSizes, questionShapes, staleQuestionShapes, type ImageSize } from "@/lib/image-sizes";
import { webpSize } from "@/lib/webp-size";

function riff(chunk: string, payload: number[]): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  bytes.set([..."WEBP"].map((c) => c.charCodeAt(0)), 8);
  bytes.set([...chunk].map((c) => c.charCodeAt(0)), 12);
  bytes.set(payload, 20);
  return bytes;
}

describe("webpSize", () => {
  it("reads a lossy VP8 key frame", () => {
    // frame tag (3 bytes), start code 9d 01 2a, width 1070, height 312 (14-bit little-endian)
    expect(webpSize(riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 1070 & 0xff, 1070 >> 8, 312 & 0xff, 312 >> 8]))).toEqual([1070, 312]);
  });

  it("reads a lossless VP8L header", () => {
    const bits = (1070 - 1) | ((4388 - 1) << 14);
    expect(webpSize(riff("VP8L", [0x2f, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff]))).toEqual([1070, 4388]);
  });

  it("reads an extended VP8X canvas", () => {
    const w = 1098 - 1, h = 185 - 1;
    expect(webpSize(riff("VP8X", [0, 0, 0, 0, w & 0xff, (w >> 8) & 0xff, w >> 16, h & 0xff, (h >> 8) & 0xff, h >> 16]))).toEqual([1098, 185]);
  });

  it("rejects anything that is not a WebP header", () => {
    expect(webpSize(new Uint8Array(30))).toBeNull();
    expect(webpSize(riff("VP8 ", [0, 0, 0, 0, 0, 0, 1, 0, 1, 0]))).toBeNull();
    expect(webpSize(riff("VP8 ", [0, 0, 0, 0x9d]).subarray(0, 24))).toBeNull();
  });
});

describe("image size files", () => {
  it("round-trips every size through the compact per-bank encoding", () => {
    const sizes = new Map<string, ImageSize>([
      ["bank/releases/r1/questions/p1/q1-2-1.webp", [1070, 312]],
      ["bank/releases/r1/questions/p1/q2-2-1.webp", [1070, 4388]],
      ["bank/releases/r1/questions/p1/q3-2-1.webp", [774, 90]],
      ["bank/releases/r1/markschemes/p1/q1-6-1.webp", [1098, 185]],
    ]);
    const encoded = JSON.parse(JSON.stringify(encodeImageSizes(sizes)));
    expect(encoded.prefix).toBe("bank/releases/r1/");
    expect(encoded.dirs["questions/p1/"]).toEqual([1070, { "q1-2-1": 312, "q2-2-1": 4388, "q3-2-1": [774, 90] }]);
    const lookup = imageSizeLookup(encoded);
    for (const [path, size] of sizes) expect(lookup(path)).toEqual(size);
    expect(lookup("bank/releases/r1/questions/p1/q9-2-1.webp")).toBeNull();
    expect(lookup("bank/releases/r1/questions/p1/constructor.webp")).toBeNull();
    expect(lookup("other/releases/r1/questions/p1/q1-2-1.webp")).toBeNull();
    expect(imageSizeLookup(null)("bank/releases/r1/questions/p1/q1-2-1.webp")).toBeNull();
  });
});

describe("regenerating sizes", () => {
  const known = new Map<string, ImageSize>([["b/q/a.webp", [1070, 312]], ["b/q/b.webp", [1070, 900]]]);
  const previous = (path: string) => known.get(path) ?? null;

  it("keeps a committed size the run could not measure (offline, no local crop)", () => {
    const merged = mergeMeasuredSizes(["b/q/a.webp", "b/q/b.webp"], new Map([["b/q/b.webp", [1070, 900]]]), previous);
    expect(Object.fromEntries(merged.sizes)).toEqual({ "b/q/a.webp": [1070, 312], "b/q/b.webp": [1070, 900] });
    expect(merged.retained).toEqual(["b/q/a.webp"]);
    expect(merged.lost).toEqual([]);
  });

  it("drops unmeasured sizes only when coverage loss is allowed, and reports each one", () => {
    const merged = mergeMeasuredSizes(["b/q/a.webp"], new Map(), previous, { allowCoverageLoss: true });
    expect(merged.sizes.size).toBe(0);
    expect(merged.lost).toEqual(["b/q/a.webp"]);
  });

  it("reports a re-measured size that differs from the committed one", () => {
    const merged = mergeMeasuredSizes(["b/q/a.webp"], new Map([["b/q/a.webp", [1070, 313]]]), previous);
    expect(merged.changed).toEqual([{ path: "b/q/a.webp", from: [1070, 312], to: [1070, 313] }]);
  });

  it("forgets paths the bank no longer delivers", () => {
    expect(mergeMeasuredSizes(["b/q/new.webp"], new Map(), previous).sizes.size).toBe(0);
  });
});

describe("per-question shapes", () => {
  it("round-trips each question's image sizes and leaves out questions with none", () => {
    const encoded = JSON.parse(JSON.stringify(encodeQuestionShapes([
      ["q2", [[1070, 300], [774, 90], null]],
      ["q1", [[1070, 1200]]],
      ["q3", [null]],
    ])));
    expect(encoded).toEqual({ width: 1070, questions: { q1: [1200], q2: [300, [774, 90], null] } });
    expect(questionShapes(encoded, "q2")).toEqual([[1070, 300], [774, 90], null]);
    expect(questionShapes(encoded, "q3")).toBeUndefined();
    expect(questionShapes(encoded, "constructor")).toBeUndefined();
  });

  it("flags shapes that no longer match the delivered question images", () => {
    const shapes = encodeQuestionShapes([["q1", [[1070, 1200]]], ["q2", [[1070, 300]]], ["q3", [[1070, 50]]]]);
    const manifest = {
      q1: { questionAssetPaths: ["a.webp"], questionAssetSizes: [[1070, 1200]] as Array<[number, number] | null> },
      q2: { questionAssetPaths: ["b-recut.webp"], questionAssetSizes: [[1070, 340]] as Array<[number, number] | null> },
      q3: { questionAssetPaths: ["c.webp", "c2.webp"], questionAssetSizes: [[1070, 50], [1070, 60]] as Array<[number, number] | null> },
    };
    expect(staleQuestionShapes(manifest, shapes)).toEqual(["q2", "q3"]);
    expect(staleQuestionShapes(manifest, null)).toEqual([]);
  });
});
