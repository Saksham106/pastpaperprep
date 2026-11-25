import { describe, expect, it } from "vitest";
import { encodeImageSizes, imageSizeLookup, type ImageSize } from "@/lib/image-sizes";
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
