import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { fetchVerifiedImageBlob } from "@/lib/verified-asset-bytes";

const expected = createHash("sha256").update("same-dimension-image-A").digest("hex");
const cryptoStub = { subtle: { digest: vi.fn(async (_algorithm: string, bytes: ArrayBuffer) =>
  Uint8Array.from(createHash("sha256").update(Buffer.from(bytes)).digest()).buffer) } };

describe("runtime asset hash gate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the exact fetched bytes only when SHA-256 matches the approved source image", async () => {
    vi.stubGlobal("crypto", cryptoStub);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("same-dimension-image-A", { status: 200, headers: { "content-type": "image/webp" } })));
    const blob = await fetchVerifiedImageBlob("https://assets.test/a.webp", expected);
    expect(blob.size).toBe(Buffer.byteLength("same-dimension-image-A"));
  });

  it("rejects changed image bytes even if the URL and raster dimensions would be unchanged", async () => {
    vi.stubGlobal("crypto", cryptoStub);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("same-dimension-image-B", { status: 200, headers: { "content-type": "image/webp" } })));
    await expect(fetchVerifiedImageBlob("https://assets.test/a.webp", expected))
      .rejects.toThrow("Verified image SHA-256 mismatch");
  });

  it("fails closed on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied", { status: 403 })));
    await expect(fetchVerifiedImageBlob("https://assets.test/a.webp", expected))
      .rejects.toThrow("Could not verify the original image");
  });
});
