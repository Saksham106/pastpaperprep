import { describe, expect, it, vi } from "vitest";
import { fetchSignedAssets, isSignedAssetFresh, signedAssetKey } from "@/lib/signed-assets";

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
