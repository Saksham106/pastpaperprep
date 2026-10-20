import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, createAdminClient, getClaims, from, rpc, createSignedUrls } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
// No live question is solution-only since the official May 2026 AA papers replaced the donated
// reconstructions, so the answer-only path is exercised with a copy that has no mark-scheme images.
const SOLUTION_ONLY = "2026-may-p1-tz1-q99";
vi.mock("@/lib/question-loader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/question-loader")>();
  return {
    ...actual,
    loadBankQuestionMap: async (bank: Parameters<typeof actual.loadBankQuestionMap>[0]) => {
      const map = new Map(await actual.loadBankQuestionMap(bank));
      const base = bank === "ib-sl" ? map.get("2026-may-p1-tz1-q1") : undefined;
      if (base) map.set(SOLUTION_ONLY, { ...base, id: SOLUTION_ONLY, markschemeImages: [], markschemeImageCount: 0, markschemeAssetPaths: [] });
      return map;
    },
  };
});

import { POST } from "./route";
import reviewed0606 from "@/data/reviewed-blank-tails-0606.json";

function request(body: unknown) {
  return new Request("https://pastpaperprep.com/api/pdf/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/pdf/sign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });
    const entitlementQuery = {
      select: vi.fn(() => entitlementQuery),
      eq: vi.fn().mockResolvedValue({ data: [{ product_id: "bundle_all", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }], error: null }),
    };
    from.mockReturnValue(entitlementQuery);
    rpc.mockImplementation((name: string) => Promise.resolve(name === "get_custom_bundle_access" ? { data: [], error: null } : { data: true, error: null }));
    createClient.mockResolvedValue({ auth: { getClaims }, from, rpc });
    createSignedUrls.mockImplementation(async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://assets.example/${path}` })), error: null }));
    createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrls })) } });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects exports containing more than 50 distinct questions before authentication", async () => {
    const questionIds = Array.from({ length: 51 }, (_, index) => `question-${index}`);
    const response = await POST(request({ bank: "ib-sl", questionIds, content: "questions" }));
    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects explanation content before authentication, signing, or any quota mutation", async () => {
    const response = await POST(request({ bank: "ib-sl", questionIds: ["2026-may-p2-tz1-q2"], content: "explanation" }));
    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not export explanations when client asset requests are smuggled into a PDF request", async () => {
    const response = await POST(request({
      bank: "ib-sl", questionIds: ["2026-may-p2-tz1-q2"], content: "questions",
      requests: [{ questionId: "2026-may-p2-tz1-q2", kind: "explanation" }],
      paths: ["explanations/ib-sl/2026-may-p2-tz1-q2.json"],
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.assets.every((asset: { kind: string }) => asset.kind === "question")).toBe(true);
    expect(createSignedUrls.mock.calls[0][0].every((path: string) => path.endsWith(".webp"))).toBe(true);
    expect(rpc).not.toHaveBeenCalledWith("consume_explanation_allowance", expect.anything());
  });

  it("requires authentication", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: {} } });
    const response = await POST(request({ bank: "ib-sl", questionIds: ["2026-may-p2-tz1-q2"], content: "questions" }));
    expect(response.status).toBe(401);
  });

  it("describes missing access at the question-bank level", async () => {
    const entitlementQuery = {
      select: vi.fn(() => entitlementQuery),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    from.mockReturnValueOnce(entitlementQuery);

    const response = await POST(request({ bank: "ib-sl", questionIds: ["2026-may-p2-tz1-q2"], content: "questions" }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Paid access to this question bank is required for PDF export" });
  });

  it("derives and atomically consumes exact question and asset counts after signing", async () => {
    const response = await POST(request({ bank: "ib-sl", questionIds: ["2026-may-p2-tz1-q2"], content: "questions" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(createSignedUrls).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("consume_pdf_export_allowance", { p_export_key: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_asset_count: 2,
      p_pdf_question_count: 1,
    });
  });

  it("falls back to the old allowance while the repeat-free function isn't deployed yet", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(
      name === "get_custom_bundle_access" ? { data: [], error: null }
        : name === "consume_pdf_export_allowance" ? { data: null, error: { code: "PGRST202", message: "Could not find the function" } }
          : { data: true, error: null }));
    const response = await POST(request({ bank: "ib-sl", questionIds: ["2026-may-p2-tz1-q2"], content: "questions" }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith("consume_download_allowance", { p_asset_count: 2, p_pdf_question_count: 1 });
  });

  it("uses the same worksheet key for the same questions in any order", async () => {
    await POST(request({ bank: "ib-sl", questionIds: ["2026-may-p2-tz1-q2"], content: "questions" }));
    await POST(request({ bank: "ib-sl", questionIds: ["2026-may-p2-tz1-q2"], content: "questions" }));
    const keys = rpc.mock.calls.filter(([name]) => name === "consume_pdf_export_allowance").map(([, args]) => (args as { p_export_key: string }).p_export_key);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it("exports a retired question id from an already-open page through its replacement", async () => {
    const { fetchPdfAssets } = await import("@/lib/signed-assets");
    const fetcher = (async (_url: string, init?: RequestInit) => POST(new Request("https://pastpaperprep.com/api/pdf/sign", { method: "POST", body: init?.body, headers: { "content-type": "application/json" } }))) as unknown as typeof fetch;
    const signed = await fetchPdfAssets("ib-sl", ["m26-math-aasl-p2-tza-q2"], "both", fetcher);
    expect([...signed.keys()].sort()).toEqual(["m26-math-aasl-p2-tza-q2:answer", "m26-math-aasl-p2-tza-q2:question"]);
    expect(signed.get("m26-math-aasl-p2-tza-q2:question")?.urls[0]).toContain("ib-sl/questions/2026-may-p2-tz1-q2");
    expect(rpc).toHaveBeenCalledWith("consume_pdf_export_allowance", expect.objectContaining({ p_pdf_question_count: 1 }));
  });

  it("counts answer-only solution questions without requiring an image", async () => {
    const response = await POST(request({ bank: "ib-sl", questionIds: [SOLUTION_ONLY], content: "answers" }));
    expect(response.status).toBe(200);
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("consume_pdf_export_allowance", { p_export_key: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_asset_count: 0,
      p_pdf_question_count: 1,
    });
    await expect(response.json()).resolves.toMatchObject({ assets: [] });
  });

  it("does not return signed assets after the worksheet allowance is exhausted", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(name === "get_custom_bundle_access" ? { data: [], error: null } : { data: false, error: null }));
    const response = await POST(request({ bank: "ib-sl", questionIds: ["2026-may-p2-tz1-q2"], content: "questions" }));
    expect(response.status).toBe(429);
    expect(createSignedUrls).toHaveBeenCalledOnce();
  });

  it("does not consume worksheet allowance when private signing fails", async () => {
    createSignedUrls.mockRejectedValueOnce(new Error("NotFound"));
    const response = await POST(request({ bank: "ib-sl", questionIds: ["2026-may-p2-tz1-q2"], content: "questions" }));

    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalledWith("consume_pdf_export_allowance", expect.anything());
  });

  it("signs exact source print geometry for the intact 0580 Q16 crop", async () => {
    const response = await POST(request({ bank: "igcse", questionIds: ["0580-2025-november-11-q16"], content: "questions" }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.assets[0].printSizesPt).toEqual([[513, 734.33]]);
  });

  it("signs 0606 source-page boundaries for an intact stitched question", async () => {
    const response = await POST(request({ bank: "igcse-additional", questionIds: ["0606-2016-june-13-q11"], content: "questions" }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.assets[0].printSizesPt).toEqual([[513, 2159]]);
    expect(payload.assets[0].printSegments[0].map((part: { sourceY: number; sourceHeight: number }) =>
      [part.sourceY, part.sourceHeight])).toEqual([[0, 1602], [1602, 1551], [3153, 1348]]);
    expect(payload.assets[0].printSegments[0][2]).toEqual(expect.objectContaining({
      include: false, imageSha256: reviewed0606.entries["0606-2016-june-13-q11"].imageSha256,
    }));
  });

  it("keeps preview PDF assets on Supabase while locally presigning premium assets through R2", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");

    const response = await POST(request({
      bank: "ib-sl",
      questionIds: ["2017-may-p1-tz1-q1", "2026-may-p2-tz1-q2"],
      content: "questions",
    }));

    expect(response.status).toBe(200);
    expect(createSignedUrls).toHaveBeenCalledOnce();
    const payload = await response.json();
    expect(new URL(payload.assets[0].urls[0]).hostname).toBe("assets.example");
    expect(new URL(payload.assets[1].urls[0]).hostname)
      .toBe("92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com");
    expect(rpc).toHaveBeenCalledWith("consume_pdf_export_allowance", { p_export_key: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_asset_count: 2,
      p_pdf_question_count: 2,
    });
  });

  describe("MCQ letters", () => {
    beforeEach(() => {
      vi.stubEnv("PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS", "true");
      vi.stubEnv("PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED", "true");
      // Release banks presign through R2; these are format-valid placeholders, signed locally.
      vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
      vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
      vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
      vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
      vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");
    });

    it("exports an MCQ answer as its letter and signs only the written answer", async () => {
      const response = await POST(request({ bank: "igcse-chemistry-0620", questionIds: ["0620-2025-m-12-q1", "0620-2025-m-42-q1"], content: "answers" }));
      expect(response.status).toBe(200);
      const { assets } = await response.json();
      const [mcq, written] = assets;
      expect(mcq).toMatchObject({ questionId: "0620-2025-m-12-q1", kind: "answer", urls: [], mcqAnswer: { answers: ["A"], note: null } });
      expect(written.questionId).toBe("0620-2025-m-42-q1");
      expect(written.mcqAnswer).toBeUndefined();
      expect(written.urls.length).toBeGreaterThan(0);
      expect(rpc).toHaveBeenCalledWith("consume_pdf_export_allowance", { p_export_key: expect.stringMatching(/^[0-9a-f]{64}$/), p_asset_count: written.urls.length, p_pdf_question_count: 2 });
    });

    it("exports a letters-only answer sheet without signing anything", async () => {
      const response = await POST(request({ bank: "igcse-chemistry-0620", questionIds: ["0620-2025-m-12-q1"], content: "answers" }));
      expect(response.status).toBe(200);
      expect((await response.json()).assets).toEqual([expect.objectContaining({ urls: [], mcqAnswer: { answers: ["A"], note: null } })]);
      expect(rpc).toHaveBeenCalledWith("consume_pdf_export_allowance", { p_export_key: expect.stringMatching(/^[0-9a-f]{64}$/), p_asset_count: 0, p_pdf_question_count: 1 });
    });

    it("gives signed-out and other-bank users no letter", async () => {
      getClaims.mockResolvedValueOnce({ data: { claims: null } });
      const signedOut = await POST(request({ bank: "igcse-chemistry-0620", questionIds: ["0620-2025-m-12-q1"], content: "answers" }));
      expect(signedOut.status).toBe(401);
      expect(await signedOut.text()).not.toContain("mcqAnswer");
      const query = { select: vi.fn(() => query), eq: vi.fn().mockResolvedValue({ data: [{ product_id: "bank_igcse", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }], error: null }) };
      from.mockReturnValue(query);
      const otherBank = await POST(request({ bank: "igcse-chemistry-0620", questionIds: ["0620-2025-m-12-q1"], content: "answers" }));
      expect(otherBank.status).toBe(403);
      expect(await otherBank.text()).not.toContain("mcqAnswer");
    });
  });
});
