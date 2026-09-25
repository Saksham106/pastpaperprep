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

import { POST } from "./route";

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

  it("requires authentication", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: {} } });
    const response = await POST(request({ bank: "ib-sl", questionIds: ["m26-math-aasl-p2-tza-q2"], content: "questions" }));
    expect(response.status).toBe(401);
  });

  it("describes missing access at the question-bank level", async () => {
    const entitlementQuery = {
      select: vi.fn(() => entitlementQuery),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    from.mockReturnValueOnce(entitlementQuery);

    const response = await POST(request({ bank: "ib-sl", questionIds: ["m26-math-aasl-p2-tza-q2"], content: "questions" }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Paid access to this question bank is required for PDF export" });
  });

  it("derives and atomically consumes exact question and asset counts after signing", async () => {
    const response = await POST(request({ bank: "ib-sl", questionIds: ["m26-math-aasl-p2-tza-q2"], content: "questions" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(createSignedUrls).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("consume_download_allowance", {
      p_asset_count: 2,
      p_pdf_question_count: 1,
    });
  });

  it("counts answer-only solution questions without requiring an image", async () => {
    const response = await POST(request({ bank: "ib-sl", questionIds: ["m26-math-aasl-p1-tza-q1"], content: "answers" }));
    expect(response.status).toBe(200);
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("consume_download_allowance", {
      p_asset_count: 0,
      p_pdf_question_count: 1,
    });
    await expect(response.json()).resolves.toMatchObject({ assets: [] });
  });

  it("does not return signed assets after the worksheet allowance is exhausted", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(name === "get_custom_bundle_access" ? { data: [], error: null } : { data: false, error: null }));
    const response = await POST(request({ bank: "ib-sl", questionIds: ["m26-math-aasl-p2-tza-q2"], content: "questions" }));
    expect(response.status).toBe(429);
    expect(createSignedUrls).toHaveBeenCalledOnce();
  });

  it("does not consume worksheet allowance when private signing fails", async () => {
    createSignedUrls.mockRejectedValueOnce(new Error("NotFound"));
    const response = await POST(request({ bank: "ib-sl", questionIds: ["m26-math-aasl-p2-tza-q2"], content: "questions" }));

    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalledWith("consume_download_allowance", expect.anything());
  });

  it("keeps preview PDF assets on Supabase while locally presigning premium assets through R2", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");

    const response = await POST(request({
      bank: "ib-sl",
      questionIds: ["2017-may-p1-tz1-q1", "m26-math-aasl-p2-tza-q2"],
      content: "questions",
    }));

    expect(response.status).toBe(200);
    expect(createSignedUrls).toHaveBeenCalledOnce();
    const payload = await response.json();
    expect(new URL(payload.assets[0].urls[0]).hostname).toBe("assets.example");
    expect(new URL(payload.assets[1].urls[0]).hostname)
      .toBe("92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com");
    expect(rpc).toHaveBeenCalledWith("consume_download_allowance", {
      p_asset_count: 2,
      p_pdf_question_count: 2,
    });
  });
});
