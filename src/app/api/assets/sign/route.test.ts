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

import { POST } from "@/app/api/assets/sign/route";

describe("POST /api/assets/sign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
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

  it("rejects invalid JSON before touching authentication", async () => {
    const response = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON" });
  });

  it("rejects JSON null instead of throwing", async () => {
    const response = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: "null",
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid asset request" });
  });

  it("rejects unknown banks and malformed batches", async () => {
    const unknownBank = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "other", requests: [] }),
      headers: { "content-type": "application/json" },
    }));
    const malformedBatch = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "ib-sl", requests: "all" }),
      headers: { "content-type": "application/json" },
    }));

    expect(unknownBank.status).toBe(400);
    expect(malformedBatch.status).toBe(400);
  });

  it("signs paid assets and then atomically consumes the daily allowance", async () => {
    const response = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "ib-sl", requests: [{ questionId: "m26-math-aasl-p2-tza-q2", kind: "question" }] }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(rpc).toHaveBeenCalledWith("consume_download_allowance", { p_asset_count: 2, p_pdf_question_count: 0 });
    expect(createSignedUrls).toHaveBeenCalledOnce();
    const payload = await response.json();
    expect(payload.assets[0].details).toEqual(expect.objectContaining({
      accessibleText: expect.any(String),
    }));
    expect(payload.assets[0].details).not.toHaveProperty("searchText");
  });

  it("does not charge the premium allowance for preview assets", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
    const response = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "ib-sl", requests: [{ questionId: "2017-may-p1-tz1-q1", kind: "question" }] }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalledWith("consume_download_allowance", expect.anything());
    expect(createSignedUrls).toHaveBeenCalledOnce();
  });

  it("does not return paid assets after the daily allowance is exhausted", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(name === "get_custom_bundle_access" ? { data: [], error: null } : { data: false, error: null }));
    const response = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "ib-sl", requests: [{ questionId: "m26-math-aasl-p1-tza-q4", kind: "question" }] }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(429);
    expect(createSignedUrls).toHaveBeenCalledOnce();
  });

  it("uses local R2 presigning for paid assets without Supabase or R2 API operations", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");

    const response = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "ib-sl", requests: [{ questionId: "m26-math-aasl-p2-tza-q2", kind: "question" }] }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(createSignedUrls).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(new URL(payload.assets[0].urls[0]).hostname)
      .toBe("92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com");
  });

  it("does not consume allowance when private signing fails", async () => {
    createSignedUrls.mockRejectedValueOnce(new Error("NotFound"));
    const response = await POST(new Request("https://pastpaperprep.com/api/assets/sign", {
      method: "POST",
      body: JSON.stringify({ bank: "ib-sl", requests: [{ questionId: "m26-math-aasl-p2-tza-q2", kind: "question" }] }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalledWith("consume_download_allowance", expect.anything());
  });
});
