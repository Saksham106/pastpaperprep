import { describe, expect, it, vi } from "vitest";
import { fetchPdfAssets, fetchSignedAssets, isSignedAssetFresh, signedAssetKey } from "@/lib/signed-assets";

const requests = Array.from({ length: 21 }, (_, index) => ({
  questionId: `question-${index + 1}`,
  kind: "question" as const,
}));

describe("fetchSignedAssets", () => {
  it("splits requests into authorized batches and indexes returned URLs", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { requests: typeof requests };
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request) => ({ ...request, urls: [`https://signed.test/${request.questionId}`] })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    const result = await fetchSignedAssets("ib-sl", requests, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.get(signedAssetKey("question-21", "question"))?.urls).toEqual([
      "https://signed.test/question-21",
    ]);
    expect(result.get(signedAssetKey("question-1", "question"))?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("fails closed when signing is denied", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "Access required" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    }));

    await expect(fetchSignedAssets("ib-sl", requests.slice(0, 1), fetcher)).rejects.toThrow("Access required");
  });

  it("sends one exact PDF asset batch to the quota-bound endpoint", async () => {
    const batch = requests.slice(0, 2);
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { questionIds: string[] };
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.questionIds.map((questionId) => ({ questionId, kind: "question", urls: [`https://signed.test/${questionId}`] })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    await fetchPdfAssets("ib-sl", batch.map((request) => request.questionId), "questions", fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("/api/pdf/sign", expect.objectContaining({
      body: JSON.stringify({ bank: "ib-sl", questionIds: batch.map((request) => request.questionId), content: "questions" }),
    }));
  });

  it("rejects missing requested PDF assets rather than silently exporting an incomplete worksheet", async () => {
    const fetcher = vi.fn(async () => Response.json({ expiresIn: 600, assets: [{
      questionId: "q1", kind: "question", urls: ["https://signed.test/q1.webp"],
    }] }));
    await expect(fetchPdfAssets("igcse-additional", ["q1", "q2"], "questions", fetcher))
      .rejects.toThrow("Invalid signed asset response");
    await expect(fetchPdfAssets("igcse-additional", ["q1"], "both", fetcher))
      .rejects.toThrow("Invalid signed asset response");
  });

  it("preserves verified print geometry with the exact signed PDF image", async () => {
    const fetcher = vi.fn(async () => Response.json({ expiresIn: 600, assets: [{
      questionId: "0580-2025-november-11-q16", kind: "question",
      urls: ["https://signed.test/q16.webp"], printSizesPt: [[513, 734.33]],
    }] }));
    const result = await fetchPdfAssets("igcse", ["0580-2025-november-11-q16"], "questions", fetcher);
    expect(result.get("0580-2025-november-11-q16:question")?.printSizesPt).toEqual([[513, 734.33]]);
  });

  it("keeps a full source-page segmentation attached to the exact image", async () => {
    const fetcher = vi.fn(async () => Response.json({ expiresIn: 600, assets: [{
      questionId: "0606-2016-june-13-q11", kind: "question", urls: ["https://signed.test/q11.webp"],
      printSizesPt: [[513, 2159]], rasterSizesPx: [[1070, 4501]],
      printSegments: [[
        { sourceY: 0, sourceHeight: 1602, physicalHeightPt: 768.36, sourcePage: 14 },
        { sourceY: 1602, sourceHeight: 1551, physicalHeightPt: 743.98, sourcePage: 15 },
        { sourceY: 3153, sourceHeight: 1348, physicalHeightPt: 646.66, sourcePage: 16, include: false, imageSha256: "a".repeat(64) },
      ]],
    }] }));
    const signed = await fetchPdfAssets("igcse-additional", ["0606-2016-june-13-q11"], "questions", fetcher);
    expect(signed.get("0606-2016-june-13-q11:question")?.printSegments?.[0]).toHaveLength(3);
  });

  it("rejects a PDF furniture omission with no verified source-image digest", async () => {
    const id = "0606-2016-june-13-q11";
    const asset = { questionId: id, kind: "question", urls: ["https://signed.test/q11.webp"],
      printSizesPt: [[513, 2159]], rasterSizesPx: [[1070, 4501]],
      printSegments: [[
        { sourceY: 0, sourceHeight: 3153, physicalHeightPt: 1512.34, sourcePage: 14 },
        { sourceY: 3153, sourceHeight: 1348, physicalHeightPt: 646.66, sourcePage: 16, include: false },
      ]] };
    const fetcher = vi.fn(async () => Response.json({ expiresIn: 600, assets: [asset] }));
    await expect(fetchPdfAssets("igcse-additional", [id], "questions", fetcher))
      .rejects.toThrow("Invalid signed asset response");
  });

  it("rejects a source segment that overlaps or drops raster rows", async () => {
    const fetcher = vi.fn(async () => Response.json({ expiresIn: 600, assets: [{
      questionId: "0606-2016-june-13-q11", kind: "question", urls: ["https://signed.test/q11.webp"],
      printSizesPt: [[513, 2159]], rasterSizesPx: [[1070, 4501]],
      printSegments: [[
        { sourceY: 0, sourceHeight: 1602, physicalHeightPt: 768.36, sourcePage: 14 },
        { sourceY: 1603, sourceHeight: 2898, physicalHeightPt: 1390.64, sourcePage: 15 },
      ]],
    }] }));
    await expect(fetchPdfAssets("igcse-additional", ["0606-2016-june-13-q11"], "questions", fetcher))
      .rejects.toThrow("Invalid signed asset response");
  });

  it("rejects mismatched signed image and print geometry lengths", async () => {
    const fetcher = vi.fn(async () => Response.json({ expiresIn: 600, assets: [{
      questionId: "0580-2025-november-11-q16", kind: "question",
      urls: ["https://signed.test/q16.webp"], printSizesPt: [],
    }] }));
    await expect(fetchPdfAssets("igcse", ["0580-2025-november-11-q16"], "questions", fetcher))
      .rejects.toThrow("Invalid signed asset response");
  });

  it("validates visible-height metadata before hiding a reviewed source-page tail", async () => {
    const id = "0606-2016-june-13-q11";
    const asset = { questionId: id, kind: "question", urls: ["https://signed.test/q11.webp"],
      displayCrops: [{ imageSha256: "a".repeat(64), fullWidthPx: 1070, fullHeightPx: 4501, visibleHeightPx: 3153 }] };
    const valid = vi.fn(async () => Response.json({ expiresIn: 600, assets: [asset] }));
    const signed = await fetchSignedAssets("igcse-additional", [{ questionId: id, kind: "question" }], valid);
    expect(signed.get(`${id}:question`)?.displayCrops?.[0]?.visibleHeightPx).toBe(3153);
    const malformed = vi.fn(async () => Response.json({ expiresIn: 600, assets: [{ ...asset,
      displayCrops: [{ imageSha256: "a".repeat(64), fullWidthPx: 1070, fullHeightPx: 4501, visibleHeightPx: 4501 }] }] }));
    await expect(fetchSignedAssets("igcse-additional", [{ questionId: id, kind: "question" }], malformed))
      .rejects.toThrow("Invalid signed asset response");
  });

  it("keeps local preview asset signing explicit and isolated", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { requests: typeof requests };
      return new Response(JSON.stringify({
        expiresIn: 600,
        assets: body.requests.map((request) => ({ ...request, urls: ["/api/local-preview-assets/question.webp"] })),
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    await fetchSignedAssets("ib-economics-hl", requests.slice(0, 1), fetcher, true);
    expect(fetcher).toHaveBeenCalledWith("/api/local-preview-assets/sign", expect.anything());
  });

  it("rejects preview-only URLs from the paid signer", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      expiresIn: 600,
      assets: [{ ...requests[0], urls: ["/api/local-preview-assets/question.webp"] }],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(fetchSignedAssets("ib-sl", requests.slice(0, 1), fetcher)).rejects.toThrow("Invalid signed asset response");
  });

  it("rejects malformed signed asset responses", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ assets: [{ questionId: "question-1" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(fetchSignedAssets("ib-sl", requests.slice(0, 1), fetcher)).rejects.toThrow("Invalid signed asset response");
  });

  it("rejects cached URLs after their safe expiry window", () => {
    const asset = { questionId: "question-1", kind: "question" as const, urls: ["https://signed.test/question-1"], expiresAt: 2_000 };

    expect(isSignedAssetFresh(asset, 1_999)).toBe(true);
    expect(isSignedAssetFresh(asset, 2_000)).toBe(false);
  });
});
