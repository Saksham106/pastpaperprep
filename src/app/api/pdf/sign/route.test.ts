import { beforeEach, describe, expect, it, vi } from "vitest";

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
    rpc.mockResolvedValue({ data: true, error: null });
    createClient.mockResolvedValue({ auth: { getClaims }, from, rpc });
    createSignedUrls.mockImplementation(async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://assets.example/${path}` })), error: null }));
    createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrls })) } });
  });

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

  it("derives and atomically consumes exact question and asset counts after signing", async () => {
    const response = await POST(request({ bank: "ib-sl", questionIds: ["m26-math-aasl-p2-tza-q2"], content: "questions" }));
    expect(response.status).toBe(200);
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
    rpc.mockResolvedValueOnce({ data: false, error: null });
    const response = await POST(request({ bank: "ib-sl", questionIds: ["m26-math-aasl-p2-tza-q2"], content: "questions" }));
    expect(response.status).toBe(429);
    expect(createSignedUrls).toHaveBeenCalledOnce();
  });
});
