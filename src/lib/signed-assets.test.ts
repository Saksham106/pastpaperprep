import { afterEach, describe, expect, it, vi } from "vitest";
import { FREE_ASSET_CDN_MAX_AGE, FREE_ASSET_EXPIRES_IN, fetchFreeAssets, fetchPdfAssets, fetchSignedAssets, isSignedAssetFresh, preferSignedFreeAssets, resetFreeAssetRecovery, signAssetBatches, signedAssetKey } from "@/lib/signed-assets";

const requests = Array.from({ length: 21 }, (_, index) => ({
  questionId: `question-${index + 1}`,
  kind: "question" as const,
}));

describe("fetchSignedAssets", () => {
  it.each(["signed", "pdf"] as const)("does not dispatch an already obsolete %s scope", async (kind) => {
    const fetcher = vi.fn(async () => Response.json({ expiresIn: 600, assets: [] }));
    const pending = kind === "signed"
      ? fetchSignedAssets("ib-sl", requests, fetcher, false, () => false)
      : fetchPdfAssets("ib-sl", ["question-1"], "questions", fetcher, false, () => false);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["signed", "pdf"] as const)("abandons %s payloads parsed after scope turnover", async (kind) => {
    let current = true;
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => {
      current = false;
      return { expiresIn: 600, assets: [{ ...requests[0], urls: ["https://signed.test/q"] }] };
    } }) as Response);
    const pending = kind === "signed"
      ? fetchSignedAssets("ib-sl", requests.slice(0, 1), fetcher, false, () => current)
      : fetchPdfAssets("ib-sl", ["question-1"], "questions", fetcher, false, () => current);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("abandons a PDF response before parsing it when the scope expires", async () => {
    let current = true;
    const json = vi.fn(async () => ({ expiresIn: 600, assets: [] }));
    const fetcher = vi.fn(async () => { current = false; return { ok: true, json } as unknown as Response; });
    await expect(fetchPdfAssets("ib-sl", ["question-1"], "questions", fetcher, false, () => current)).rejects.toMatchObject({ name: "AbortError" });
    expect(json).not.toHaveBeenCalled();
  });
  it("abandons a paid batch response before dispatching the next batch when its scope expires", async () => {
    let current = true;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      current = false;
      const { requests: batch } = JSON.parse(String(init?.body));
      return Response.json({ expiresIn: 600, assets: batch.map((request: object) => ({ ...request, urls: ["https://signed.test/q"] })) });
    });
    await expect(fetchSignedAssets("ib-sl", requests, fetcher, false, () => current)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
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

  it("accepts a hash-bound BLANK PAGE in the middle of a crop but never an all-hidden crop", async () => {
    const id = "0580-2022-june-43-q10";
    const segments = (hiddenSha?: string) => [
      { sourceY: 0, sourceHeight: 1500, physicalHeightPt: 720, sourcePage: 18 },
      { sourceY: 1500, sourceHeight: 1400, physicalHeightPt: 672, sourcePage: 19, include: false, ...(hiddenSha ? { imageSha256: hiddenSha } : {}) },
      { sourceY: 2900, sourceHeight: 1500, physicalHeightPt: 720, sourcePage: 20 },
    ];
    const respond = (printSegments: unknown) => vi.fn(async () => Response.json({ expiresIn: 600, assets: [{
      questionId: id, kind: "question", urls: ["https://signed.test/q10.webp"],
      printSizesPt: [[513, 2112]], rasterSizesPx: [[1070, 4400]], printSegments: [printSegments],
    }] }));
    const signed = await fetchPdfAssets("igcse", [id], "questions", respond(segments("a".repeat(64))));
    expect(signed.get(`${id}:question`)?.printSegments?.[0]?.[1]).toMatchObject({ include: false });
    await expect(fetchPdfAssets("igcse", [id], "questions", respond(segments())))
      .rejects.toThrow("Invalid signed asset response");
    const allHidden = segments("a".repeat(64)).map((part) => ({ ...part, include: false, imageSha256: "a".repeat(64) }));
    await expect(fetchPdfAssets("igcse", [id], "questions", respond(allHidden)))
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

describe("fetchSignedAssets batching", () => {
  it("anchors each batch's expiry before waiting for slower parallel batches", async () => {
    vi.useFakeTimers();
    const start = Date.now();
    vi.setSystemTime(start);
    try {
      const requests = Array.from({ length: 24 }, (_, i) => ({ questionId: `q${i}`, kind: "question" as const }));
      let calls = 0;
      let release!: () => void;
      const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        const response = () => new Response(JSON.stringify({ expiresIn: 60, assets: body.requests.map((r: object) => ({ ...r, urls: ["https://assets.example/q.webp"] })) }));
        if (++calls === 1) return Promise.resolve(response());
        return new Promise<Response>(resolve => { release = () => resolve(response()); });
      });
      const result = fetchSignedAssets("ib-sl", requests, fetcher);
      await vi.advanceTimersByTimeAsync(0);
      vi.setSystemTime(start + 40_000);
      release();
      const assets = await result;
      expect(assets.get("q0:question")?.expiresAt).toBe(start + 30_000);
      expect(assets.get("q20:question")?.expiresAt).toBe(start + 70_000);
    } finally { vi.useRealTimers(); }
  });

  it("sends every batch at once instead of waiting for the previous one", async () => {
    const requests = Array.from({ length: 24 }, (_, index) => ({ questionId: `q${index}`, kind: "question" as const }));
    const pending: Array<() => void> = [];
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((resolve) => {
      const body = JSON.parse(String(init?.body)) as { requests: Array<{ questionId: string; kind: string }> };
      pending.push(() => resolve(new Response(JSON.stringify({ expiresIn: 600, assets: body.requests.map((request) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) }))));
    }));

    const result = fetchSignedAssets("ib-sl", requests, fetcher);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetcher).toHaveBeenCalledTimes(2);
    pending.forEach((release) => release());
    expect([...(await result).keys()]).toEqual(requests.map((request) => `${request.questionId}:question`));
  });
});

describe("signAssetBatches", () => {
  const requests = Array.from({ length: 24 }, (_, index) => ({ questionId: `q${index}`, kind: "question" as const }));
  const ok = (init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { requests: Array<{ questionId: string; kind: string }> };
    return Response.json({ expiresIn: 600, assets: body.requests.map((request) => ({ ...request, urls: [`https://assets.example/${request.questionId}.webp`] })) });
  };

  it.each([503, 429])("keeps a sibling batch when the other fails with %s and reports only the failed keys", async (status) => {
    let calls = 0;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ++calls === 1
      ? Response.json({ error: "Busy" }, { status }) : ok(init));
    const delivered: string[] = [];
    const result = await signAssetBatches("ib-sl", requests, { fetcher, onBatch: (assets) => delivered.push(...assets.keys()) });
    expect([...result.assets.keys()]).toEqual(requests.slice(20).map((request) => `${request.questionId}:question`));
    expect(delivered).toEqual([...result.assets.keys()]);
    expect(result.failedKeys).toEqual(requests.slice(0, 20).map((request) => `${request.questionId}:question`));
    expect(result.error?.message).toBe("Busy");
    calls = 0;
    await expect(fetchSignedAssets("ib-sl", requests, fetcher)).rejects.toThrow("Busy");
  });

  it("delivers a fast batch before a slow sibling settles", async () => {
    let release!: () => void;
    let calls = 0;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => ++calls === 1
      ? new Promise<Response>((resolve) => { release = () => resolve(ok(init)); })
      : Promise.resolve(ok(init)));
    const delivered: number[] = [];
    const result = signAssetBatches("ib-sl", requests, { fetcher, onBatch: (assets) => delivered.push(assets.size) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(delivered).toEqual([4]);
    release();
    expect((await result).assets.size).toBe(24);
    expect(delivered).toEqual([4, 20]);
  });

  it("still rejects as a whole once the scope has ended", async () => {
    let current = true;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => { current = false; return ok(init); });
    const onBatch = vi.fn();
    await expect(signAssetBatches("ib-sl", requests, { fetcher, isCurrent: () => current, onBatch })).rejects.toMatchObject({ name: "AbortError" });
    expect(onBatch).not.toHaveBeenCalled();
  });
});

describe("fetchFreeAssets", () => {
  // These cover the signing route: every bank answers "no static index" first.
  type TestFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  const signedRoute = (fetcher: TestFetcher): TestFetcher => (input, init) =>
    String(input).startsWith("/free-assets/") ? Promise.resolve(new Response(null, { status: 404 })) : fetcher(input, init);
  const ok = (questionId: string, kind: string) => new Response(JSON.stringify({
    expiresIn: 3600,
    maxAge: 900,
    asset: { questionId, kind, urls: [`https://assets.example/${questionId}.webp`] },
  }), { status: 200 });

  it("requests one cacheable GET per asset", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://pastpaperprep.com");
      return ok(url.searchParams.get("id")!, url.searchParams.get("kind")!);
    });

    const { assets, failedKeys } = await fetchFreeAssets("ib-sl", [{ questionId: "a", kind: "question" }, { questionId: "b", kind: "answer" }], signedRoute(fetcher));

    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/assets/free?bank=ib-sl&id=a&kind=question",
      "/api/assets/free?bank=ib-sl&id=b&kind=answer",
    ]);
    expect([...assets.keys()]).toEqual(["a:question", "b:answer"]);
    expect(failedKeys).toEqual([]);
  });

  it.each([undefined, "invalid", "-500", "0"])("treats cached free links conservatively with Age=%s", async (age) => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      const { assets } = await fetchFreeAssets("ib-sl", [{ questionId: "a", kind: "question" }], signedRoute(async () => {
        const response = ok("a", "question");
        if (age !== undefined) response.headers.set("age", age);
        return response;
      }));
      expect(assets.get("a:question")!.expiresAt).toBe(1_000_000 + (3600 - 900 - 300) * 1000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shortens the lifetime when the CDN reports an older copy than expected", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      const stale = () => new Response(JSON.stringify({ expiresIn: 3600, maxAge: 900, asset: { questionId: "a", kind: "question", urls: ["https://assets.example/a.webp"] } }), { status: 200, headers: { age: "3000" } });
      const { assets } = await fetchFreeAssets("ib-sl", [{ questionId: "a", kind: "question" }], signedRoute(async () => stale()));
      expect(assets.get("a:question")!.expiresAt).toBe(1_000_000 + (3600 - 3000 - 300) * 1000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves every cached free link at least a day of life", async () => {
    vi.useFakeTimers({ now: 0 });
    try {
      const response = new Response(JSON.stringify({ expiresIn: FREE_ASSET_EXPIRES_IN, maxAge: FREE_ASSET_CDN_MAX_AGE, asset: { questionId: "a", kind: "question", urls: ["https://assets.example/a.webp"] } }), { status: 200, headers: { age: String(FREE_ASSET_CDN_MAX_AGE) } });
      const { assets } = await fetchFreeAssets("ib-sl", [{ questionId: "a", kind: "question" }], signedRoute(async () => response));
      expect(assets.get("a:question")!.expiresAt).toBeGreaterThanOrEqual(23.9 * 60 * 60 * 1000);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([true, false])("revalidates an exhausted CDN link once, recovery=%s", async (recovers) => {
    const stale = () => new Response(JSON.stringify({
      expiresIn: FREE_ASSET_EXPIRES_IN, maxAge: FREE_ASSET_CDN_MAX_AGE,
      asset: { questionId: "a", kind: "question", urls: ["https://assets.example/a.webp"] },
    }), { headers: { age: String(FREE_ASSET_EXPIRES_IN) } });
    const fetcher = vi.fn().mockImplementationOnce(async () => stale())
      .mockImplementation(async () => recovers ? ok("a", "question") : stale());

    const { assets, failedKeys } = await fetchFreeAssets("ib-sl", [{ questionId: "a", kind: "question" }], signedRoute(fetcher));

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]).toEqual({ cache: "reload", headers: { "cache-control": "no-cache", pragma: "no-cache" } });
    expect(assets.size).toBe(recovers ? 1 : 0);
    expect(failedKeys).toEqual(recovers ? [] : ["a:question"]);
    if (recovers) expect(assets.get("a:question")!.expiresAt).toBeGreaterThan(Date.now() + 1000);
  });

  it.each([
    { expiresIn: -1, maxAge: 900 },
    { expiresIn: 3600, maxAge: -1 },
    { expiresIn: 3600, maxAge: 3600 },
    { expiresIn: 1e308, maxAge: 900 },
  ])("rejects invalid free expiry metadata %j", async (metadata) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ...metadata, asset: { questionId: "a", kind: "question", urls: ["https://assets.example/a.webp"] },
    })));
    const { assets, failedKeys } = await fetchFreeAssets("ib-sl", [{ questionId: "a", kind: "question" }], signedRoute(fetcher));
    expect(assets.size).toBe(0);
    expect(failedKeys).toEqual(["a:question"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reports failures per asset instead of failing the batch", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).includes("id=bad")
      ? new Response(JSON.stringify({ error: "Access required" }), { status: 403 })
      : ok("good", "question"));

    const { assets, failedKeys } = await fetchFreeAssets("ib-sl", [{ questionId: "good", kind: "question" }, { questionId: "bad", kind: "question" }], signedRoute(fetcher));

    expect([...assets.keys()]).toEqual(["good:question"]);
    expect(failedKeys).toEqual(["bad:question"]);
  });

  it("rejects a response for a different asset", async () => {
    const { assets, failedKeys } = await fetchFreeAssets("ib-sl", [{ questionId: "a", kind: "question" }], signedRoute(async () => ok("other", "question")));

    expect(assets.size).toBe(0);
    expect(failedKeys).toEqual(["a:question"]);
  });
});

describe("fetchFreeAssets with the static free index", () => {
  const publicUrl = (id: string) => `https://free.pastpaperprep.com/images/bank/questions/${id}.webp`;
  const details = { summary: "s", accessibleText: "a", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null };
  const index = (bank: string) => new Response(JSON.stringify({ version: 1, bank, questions: {
    a: { details, question: { urls: [publicUrl("a")], displayCrops: [null] } },
  } }));
  const signed = (id: string) => new Response(JSON.stringify({ expiresIn: 3600, maxAge: 900, asset: { questionId: id, kind: "question", urls: [`https://assets.example/${id}.webp`] } }));

  it("does not accept a purported empty public entry without validated rich details", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/free-assets/")
      ? Response.json({ version: 1, bank: "ib-hl", questions: { a: { question: { urls: [], displayCrops: [] } } } }) : signed("a"));
    expect((await fetchFreeAssets("ib-hl", [{ questionId: "a", kind: "question" }], fetcher)).assets.get("a:question")?.urls).toEqual(["https://assets.example/a.webp"]);
  });

  it("serves listed questions from public links without calling the signing route", async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async () => index("ib-hl"));
    const { assets, failedKeys } = await fetchFreeAssets("ib-hl", [{ questionId: "a", kind: "question" }], fetcher);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual(["/free-assets/ib-hl.json"]);
    expect(assets.get("a:question")).toMatchObject({ urls: [publicUrl("a")], details });
    expect(failedKeys).toEqual([]);
  });

  it("reads each bank's index once and signs questions it does not list", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/free-assets/") ? index("ib-ai-hl") : signed("b"));
    await fetchFreeAssets("ib-ai-hl", [{ questionId: "a", kind: "question" }], fetcher);
    const { assets } = await fetchFreeAssets("ib-ai-hl", [{ questionId: "b", kind: "question" }], fetcher);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual(["/free-assets/ib-ai-hl.json", "/api/assets/free?bank=ib-ai-hl&id=b&kind=question"]);
    expect(assets.get("b:question")?.urls).toEqual(["https://assets.example/b.webp"]);
  });

  it("ignores an index for another bank or with links outside the free bucket", async () => {
    const wrongBank = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/free-assets/") ? index("ib-sl") : signed("a"));
    expect((await fetchFreeAssets("ib-ai-sl", [{ questionId: "a", kind: "question" }], wrongBank)).assets.get("a:question")?.urls).toEqual(["https://assets.example/a.webp"]);
    const foreign = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/free-assets/")
      ? new Response(JSON.stringify({ version: 1, bank: "ib-physics-hl", questions: { a: { details, question: { urls: ["https://evil.example/a.webp"], displayCrops: [null] } } } }))
      : signed("a"));
    expect((await fetchFreeAssets("ib-physics-hl", [{ questionId: "a", kind: "question" }], foreign)).assets.get("a:question")?.urls).toEqual(["https://assets.example/a.webp"]);
  });

  it("re-reads a day-old index instead of reusing its links, and gives links the index's remaining life", async () => {
    vi.useFakeTimers({ now: 5_000_000 });
    try {
      let version = 0;
      const fetcher = vi.fn(async () => {
        version += 1;
        return new Response(JSON.stringify({ version: 1, bank: "ib-ai-hl", questions: { a: { details, question: { urls: [publicUrl(`a-v${version}`)], displayCrops: [null] } } } }));
      });
      const first = await fetchFreeAssets("ib-ai-hl", [{ questionId: "a", kind: "question" }], fetcher);
      expect(first.assets.get("a:question")!.expiresAt).toBe(5_000_000 + 24 * 60 * 60 * 1000);
      vi.setSystemTime(5_000_000 + 23 * 60 * 60 * 1000);
      const sameDay = await fetchFreeAssets("ib-ai-hl", [{ questionId: "a", kind: "question" }], fetcher);
      expect(sameDay.assets.get("a:question")!.expiresAt).toBe(5_000_000 + 24 * 60 * 60 * 1000);
      vi.setSystemTime(5_000_000 + 48 * 60 * 60 * 1000);
      const later = await fetchFreeAssets("ib-ai-hl", [{ questionId: "a", kind: "question" }], fetcher);
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(later.assets.get("a:question")?.urls).toEqual([publicUrl("a-v2")]);
    } finally { vi.useRealTimers(); }
  });

  it("settles known-failure rescue while a day-old index refresh remains pending", async () => {
    vi.useFakeTimers({ now: 5_000_000 });
    let releaseIndex!: () => void;
    try {
      let reads = 0;
      const fetcher = vi.fn((input: RequestInfo | URL) => {
        if (!String(input).startsWith("/free-assets/")) return Promise.resolve(signed("a"));
        if (++reads === 1) return Promise.resolve(index("ib-hl"));
        return new Promise<Response>((resolve) => { releaseIndex = () => resolve(index("ib-hl")); });
      });
      const request = { questionId: "a", kind: "question" as const };
      expect((await fetchFreeAssets("ib-hl", [request], fetcher)).assets.get("a:question")?.urls).toEqual([publicUrl("a")]);
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
      // An unrelated public lookup starts a refresh that may never respond.
      const lookup = fetchFreeAssets("ib-hl", [request], fetcher);
      preferSignedFreeAssets("ib-hl", request, fetcher);
      let settled = false;
      const rescue = fetchFreeAssets("ib-hl", [request, request], fetcher).then((result) => {
        settled = true;
        return result;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(true);
      expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith("/api/"))).toHaveLength(1);
      expect((await rescue).assets.get("a:question")?.urls).toEqual(["https://assets.example/a.webp"]);
      expect((await rescue).failedKeys).toEqual([]);
      // Reuse the coalesced rescue without waiting on (or restarting) the index.
      expect((await fetchFreeAssets("ib-hl", [request], fetcher)).assets.get("a:question")?.urls).toEqual(["https://assets.example/a.webp"]);
      expect(fetcher).toHaveBeenCalledTimes(3);
      releaseIndex();
      await lookup;
    } finally {
      releaseIndex?.();
      vi.useRealTimers();
    }
  });

  it("does not keep a failed index read", async () => {
    let calls = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (!String(input).startsWith("/free-assets/")) return signed("a");
      calls += 1;
      return calls === 1 ? new Response(null, { status: 503 }) : index("ib-chemistry-hl");
    });
    expect((await fetchFreeAssets("ib-chemistry-hl", [{ questionId: "a", kind: "question" }], fetcher)).assets.get("a:question")?.urls).toEqual(["https://assets.example/a.webp"]);
    expect((await fetchFreeAssets("ib-chemistry-hl", [{ questionId: "a", kind: "question" }], fetcher)).assets.get("a:question")?.urls).toEqual([publicUrl("a")]);
  });

  describe("unreachable public host", () => {
    const requests = [{ questionId: "a", kind: "question" as const }, { questionId: "b", kind: "answer" as const }, { questionId: "a", kind: "explanation" as const }];
    const makeFetcher = () => vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://example.test");
      if (url.pathname.startsWith("/free-assets/")) return Response.json({ version: 1, bank: url.pathname.split("/").pop()!.replace(".json", ""), questions: {
        a: { details, question: { urls: [publicUrl("a")], displayCrops: [null] }, explanation: { urls: [publicUrl("explanation")], displayCrops: [null] } },
        b: { details, answer: { urls: [publicUrl("answer")], displayCrops: [null] } },
      } });
      return Response.json({ expiresIn: 3600, maxAge: 0, asset: { questionId: url.searchParams.get("id"), kind: url.searchParams.get("kind"), urls: ["https://assets.example/rescue.webp"] } });
    });
    const apiCalls = (fetcher: ReturnType<typeof makeFetcher>) => fetcher.mock.calls.filter(([url]) => String(url).startsWith("/api/")).length;
    const indexCalls = (fetcher: ReturnType<typeof makeFetcher>) => fetcher.mock.calls.filter(([url]) => String(url).startsWith("/free-assets/")).length;
    const allSigned = (assets: Map<string, { urls: string[] }>) => [...assets.values()].every((asset) => asset.urls[0] === "https://assets.example/rescue.webp");
    const allPublic = (assets: Map<string, { urls: string[] }>) => [...assets.values()].every((asset) => asset.urls[0].startsWith("https://free.pastpaperprep.com/"));

    it("switches every bank to signed links for a day once two different public assets fail", async () => {
      vi.useFakeTimers({ now: 4_000_000 });
      try {
        const fetcher = makeFetcher();
        expect(allPublic((await fetchFreeAssets("ib-hl", requests, fetcher)).assets)).toBe(true);
        preferSignedFreeAssets("ib-hl", requests[0], fetcher);
        preferSignedFreeAssets("ib-sl", requests[1], fetcher); // a different bank still counts: one host serves both
        const rescued = await fetchFreeAssets("ib-hl", requests, fetcher);
        expect(rescued.failedKeys).toEqual([]);
        expect(allSigned(rescued.assets)).toBe(true);
        // An untouched bank skips its public index entirely and keeps the signed link's full life.
        const reads = indexCalls(fetcher);
        const other = await fetchFreeAssets("ib-physics-hl", [requests[0]], fetcher);
        expect(other.assets.get("a:question")).toMatchObject({ urls: ["https://assets.example/rescue.webp"], expiresAt: 4_000_000 + (3600 - 300) * 1000 });
        expect(indexCalls(fetcher)).toBe(reads);
        // Past the per-asset cooldown the switch still holds.
        vi.advanceTimersByTime(60_000);
        expect(allSigned((await fetchFreeAssets("ib-hl", requests, fetcher)).assets)).toBe(true);
        // Another fetcher has its own network state.
        expect(allPublic((await fetchFreeAssets("ib-hl", requests, makeFetcher())).assets)).toBe(true);
        vi.advanceTimersByTime(24 * 60 * 60 * 1000);
        expect(allPublic((await fetchFreeAssets("ib-hl", requests, fetcher)).assets)).toBe(true);
      } finally { vi.useRealTimers(); }
    });

    it("keeps per-asset recovery for one broken object, even when it fails repeatedly", async () => {
      vi.useFakeTimers({ now: 4_000_000 });
      try {
        const fetcher = makeFetcher();
        preferSignedFreeAssets("ib-hl", requests[0], fetcher);
        preferSignedFreeAssets("ib-hl", requests[0], fetcher); // duplicate onError for the same image
        const { assets } = await fetchFreeAssets("ib-hl", requests, fetcher);
        expect(assets.get("a:question")?.urls).toEqual(["https://assets.example/rescue.webp"]);
        expect(assets.get("b:answer")?.urls).toEqual([publicUrl("answer")]);
        expect(assets.get("a:explanation")?.urls).toEqual([publicUrl("explanation")]);
        // The same object failing again after its cooldown is still one object.
        vi.advanceTimersByTime(60_000);
        preferSignedFreeAssets("ib-hl", requests[0], fetcher);
        expect((await fetchFreeAssets("ib-hl", [requests[1]], fetcher)).assets.get("b:answer")?.urls).toEqual([publicUrl("answer")]);
      } finally { vi.useRealTimers(); }
    });

    it("does not add up isolated failures that are far apart", async () => {
      vi.useFakeTimers({ now: 4_000_000 });
      try {
        const fetcher = makeFetcher();
        preferSignedFreeAssets("ib-hl", requests[0], fetcher);
        vi.advanceTimersByTime(10 * 60_000);
        preferSignedFreeAssets("ib-hl", requests[1], fetcher);
        const { assets } = await fetchFreeAssets("ib-hl", requests, fetcher);
        expect(assets.get("b:answer")?.urls).toEqual(["https://assets.example/rescue.webp"]);
        expect(assets.get("a:question")?.urls).toEqual([publicUrl("a")]);
        expect(apiCalls(fetcher)).toBe(1);
      } finally { vi.useRealTimers(); }
    });

    it("keeps the switch through an explicit retry", async () => {
      vi.useFakeTimers({ now: 4_000_000 });
      try {
        const fetcher = makeFetcher();
        preferSignedFreeAssets("ib-hl", requests[0], fetcher);
        preferSignedFreeAssets("ib-hl", requests[1], fetcher);
        resetFreeAssetRecovery("ib-hl", requests, fetcher);
        expect(allSigned((await fetchFreeAssets("ib-hl", requests, fetcher)).assets)).toBe(true);
      } finally { vi.useRealTimers(); }
    });

    describe("with the page's own fetch", () => {
      const KEY = "pastpaperprep:free-public-host-unavailable-until";
      afterEach(() => {
        localStorage.removeItem(KEY);
        vi.unstubAllGlobals();
        vi.useRealTimers();
      });

      it("remembers the switch in this browser for a day, storing only its expiry", async () => {
        vi.useFakeTimers({ now: 4_000_000 });
        vi.stubGlobal("fetch", makeFetcher());
        preferSignedFreeAssets("ib-hl", requests[0]);
        expect(localStorage.getItem(KEY)).toBeNull();
        preferSignedFreeAssets("ib-hl", requests[1]);
        expect(localStorage.getItem(KEY)).toBe(String(4_000_000 + 24 * 60 * 60 * 1000));
        // A new tab: fresh module state and a fresh fetch still skip the public host.
        vi.resetModules();
        const fresh = await import("@/lib/signed-assets");
        const nextTab = makeFetcher();
        vi.stubGlobal("fetch", nextTab);
        expect(allSigned((await fresh.fetchFreeAssets("ib-hl", requests)).assets)).toBe(true);
        expect(indexCalls(nextTab)).toBe(0);
        vi.advanceTimersByTime(24 * 60 * 60 * 1000);
        expect(allPublic((await fresh.fetchFreeAssets("ib-hl", requests)).assets)).toBe(true);
        expect(localStorage.getItem(KEY)).toBeNull();
      });

      it.each(["not-a-number", String(4_000_000 + 48 * 60 * 60 * 1000), "1"])("ignores a stored value of %s", async (stored) => {
        vi.useFakeTimers({ now: 4_000_000 });
        localStorage.setItem(KEY, stored);
        vi.resetModules();
        const fresh = await import("@/lib/signed-assets");
        vi.stubGlobal("fetch", makeFetcher());
        expect(allPublic((await fresh.fetchFreeAssets("ib-hl", requests)).assets)).toBe(true);
        expect(localStorage.getItem(KEY)).toBeNull();
      });

      it("keeps an injected fetcher's switch out of storage", async () => {
        vi.useFakeTimers({ now: 4_000_000 });
        const fetcher = makeFetcher();
        preferSignedFreeAssets("ib-hl", requests[0], fetcher);
        preferSignedFreeAssets("ib-hl", requests[1], fetcher);
        expect(localStorage.getItem(KEY)).toBeNull();
      });
    });
  });

  it.each(["network", "invalid"])("retries a rejected or invalid index load: %s", async (mode) => {
    let reads = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (!String(input).startsWith("/free-assets/")) return signed("a");
      if (++reads > 1) return index("ib-hl");
      if (mode === "network") throw new TypeError("network unavailable");
      return Response.json({ version: 999, bank: "ib-hl", questions: {} });
    });
    expect((await fetchFreeAssets("ib-hl", [{ questionId: "a", kind: "question" }], fetcher)).assets.get("a:question")?.urls).toEqual(["https://assets.example/a.webp"]);
    expect((await fetchFreeAssets("ib-hl", [{ questionId: "a", kind: "question" }], fetcher)).assets.get("a:question")?.urls).toEqual([publicUrl("a")]);
    expect(reads).toBe(2);
  });

  it("does not reuse a rescue link beyond its shorter safe signed lifetime", async () => {
    vi.useFakeTimers({ now: 3_000_000 });
    try {
      const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/free-assets/") ? index("ib-hl")
        : Response.json({ expiresIn: 301, maxAge: 0, asset: { questionId: "a", kind: "question", urls: ["https://assets.example/a.webp"] } }));
      const request = { questionId: "a", kind: "question" as const };
      preferSignedFreeAssets("ib-hl", request, fetcher);
      expect((await fetchFreeAssets("ib-hl", [request], fetcher)).assets.size).toBe(1);
      vi.advanceTimersByTime(1000);
      const next = await fetchFreeAssets("ib-hl", [request], fetcher);
      expect(next.assets.size).toBe(0);
      expect(next.failedKeys).toEqual(["a:question"]);
      expect(fetcher).toHaveBeenCalledTimes(1); // no index lookup or request storm inside the cooldown
    } finally { vi.useRealTimers(); }
  });

  it.each([true, false])("coalesces repeated outage rescue and allows a fresh public probe, rescue=%s", async (succeeds) => {
    vi.useFakeTimers({ now: 2_000_000 });
    try {
      const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/free-assets/")
        ? index("ib-hl") : succeeds ? signed("a") : new Response(null, { status: 503 }));
      const request = { questionId: "a", kind: "question" as const };
      preferSignedFreeAssets("ib-hl", request, fetcher);
      const results = await Promise.all(Array.from({ length: 8 }, () => fetchFreeAssets("ib-hl", [request], fetcher)));
      vi.advanceTimersByTime(30_000);
      preferSignedFreeAssets("ib-hl", request, fetcher); // duplicate onError must not extend cooldown
      await fetchFreeAssets("ib-hl", [request], fetcher);
      expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith("/api/"))).toHaveLength(1);
      if (succeeds) expect(results[0].assets.get("a:question")!.expiresAt).toBe(2_060_000);
      else expect(results[0].failedKeys).toEqual(["a:question"]);
      vi.advanceTimersByTime(30_000);
      expect((await fetchFreeAssets("ib-hl", [request], fetcher)).assets.get("a:question")?.urls).toEqual([publicUrl("a")]);
    } finally { vi.useRealTimers(); }
  });

  it.each([false, true])("resets only the explicitly retried asset, bank and fetcher, stale=%s", async (stale) => {
    vi.useFakeTimers({ now: 4_000_000 });
    try {
      let recovered = false;
      const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/free-assets/")
        ? index("ib-hl") : recovered ? signed("a") : stale
          ? Response.json({ expiresIn: 301, maxAge: 0, asset: { questionId: "a", kind: "question", urls: ["https://assets.example/old.webp"] } })
          : new Response(null, { status: 503 }));
      const otherFetcher = vi.fn(async () => new Response(null, { status: 503 }));
      const request = { questionId: "a", kind: "question" as const };
      // One failure per fetcher: two different ones would switch the whole host to signed links.
      preferSignedFreeAssets("ib-hl", request, fetcher);
      preferSignedFreeAssets("ib-hl", request, otherFetcher);
      await fetchFreeAssets("ib-hl", [request], fetcher);
      await fetchFreeAssets("ib-hl", [request], otherFetcher);
      vi.advanceTimersByTime(1000); // stale signed success, or the cached null, remains inside cooldown
      recovered = true;
      await fetchFreeAssets("ib-hl", [request], fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      resetFreeAssetRecovery("ib-sl", [request], fetcher); // another bank's retry leaves this one alone
      resetFreeAssetRecovery("ib-hl", [{ questionId: "a", kind: "answer" }], fetcher); // and another kind's
      await fetchFreeAssets("ib-hl", [request], fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      resetFreeAssetRecovery("ib-hl", [request], fetcher);
      expect((await fetchFreeAssets("ib-hl", [request], fetcher)).assets.get("a:question")?.urls).toEqual([publicUrl("a")]);
      preferSignedFreeAssets("ib-hl", request, fetcher); // public object still broken: fresh rescue now allowed
      expect((await fetchFreeAssets("ib-hl", [request], fetcher)).assets.get("a:question")?.urls).toEqual(["https://assets.example/a.webp"]);
      expect((await fetchFreeAssets("ib-hl", [request], otherFetcher)).assets.size).toBe(0);
      expect(fetcher).toHaveBeenCalledTimes(3); // one index probe, one new rescue, no unrelated retries
      expect(otherFetcher).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it("rescues only the failing asset and returns to public delivery after a bounded cooldown", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/free-assets/")
        ? Response.json({ version: 1, bank: "ib-biology-hl", questions: {
          a: { details, question: { urls: [publicUrl("a")], displayCrops: [null] }, answer: { urls: [publicUrl("answer")], displayCrops: [null] } },
          b: { details, question: { urls: [publicUrl("b")], displayCrops: [null] } },
        } }) : signed("a"));
      preferSignedFreeAssets("ib-biology-hl", { questionId: "a", kind: "question" }, fetcher);
      const { assets } = await fetchFreeAssets("ib-biology-hl", [
        { questionId: "a", kind: "question" }, { questionId: "a", kind: "answer" }, { questionId: "b", kind: "question" },
      ], fetcher);
      expect(assets.get("a:question")?.urls).toEqual(["https://assets.example/a.webp"]);
      expect(assets.get("a:answer")?.urls).toEqual([publicUrl("answer")]);
      expect(assets.get("b:question")?.urls).toEqual([publicUrl("b")]);
      vi.advanceTimersByTime(60_000);
      expect((await fetchFreeAssets("ib-biology-hl", [{ questionId: "a", kind: "question" }], fetcher)).assets.get("a:question")?.urls).toEqual([publicUrl("a")]);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
});

describe("MCQ letters on answer assets", () => {
  const letter = { answers: ["B"], note: null };
  const signedAnswer = (asset: Record<string, unknown>) => vi.fn(async () => Response.json({ expiresIn: 600, assets: [{ questionId: "q1", kind: "answer", urls: [], ...asset }] }));

  it("keeps a valid letter on an answer asset", async () => {
    const signed = await fetchSignedAssets("igcse-chemistry-0620", [{ questionId: "q1", kind: "answer" }], signedAnswer({ mcqAnswer: letter }));
    expect(signed.get("q1:answer")).toMatchObject({ urls: [], mcqAnswer: letter });
  });

  it.each([
    ["a letter outside A–D", { mcqAnswer: { answers: ["E"], note: null } }],
    ["a bare string", { mcqAnswer: "B" }],
    ["a letter on a question image", { kind: "question", mcqAnswer: letter }],
  ])("rejects %s", async (_label, asset) => {
    const request = { questionId: "q1", kind: (asset as { kind?: "question" }).kind ?? "answer" as const };
    await expect(fetchSignedAssets("igcse-chemistry-0620", [request], signedAnswer(asset))).rejects.toThrow("Invalid signed asset response");
  });

  it("reads a free-year letter from the static free index without calling a route", async () => {
    const details = { summary: "s", accessibleText: "a", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null };
    const fetcher = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async () => new Response(JSON.stringify({ version: 1, bank: "igcse-physics-0625", questions: {
      q1: { details, answer: { urls: [], displayCrops: [], mcqAnswer: letter } },
    } })));
    const { assets } = await fetchFreeAssets("igcse-physics-0625", [{ questionId: "q1", kind: "answer" }], fetcher);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual(["/free-assets/igcse-physics-0625.json"]);
    expect(assets.get("q1:answer")).toMatchObject({ urls: [], mcqAnswer: letter });
  });

  it("carries the letter from the PDF signer", async () => {
    const fetcher = vi.fn(async () => Response.json({ expiresIn: 600, assets: [{ questionId: "q1", kind: "answer", urls: [], printSizesPt: [], printSegments: [], rasterSizesPx: [], mcqAnswer: letter }] }));
    const signed = await fetchPdfAssets("igcse-chemistry-0620", ["q1"], "answers", fetcher);
    expect(signed.get("q1:answer")?.mcqAnswer).toEqual(letter);
  });
});
