import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClient, createAdminClient, getClaims, from, rpc, createSignedUrls, loadBankAssetManifest } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  createSignedUrls: vi.fn(),
  loadBankAssetManifest: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/asset-manifest", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/asset-manifest")>(),
  loadBankAssetManifest,
}));

import { POST } from "@/app/api/assets/sign/route";
import { GET } from "@/app/api/assets/free/route";

const PAID = "m26-math-aasl-p2-tza-q2";
const FREE = "2017-may-p1-tz1-q1";
const details = { summary: "s", accessibleText: "t", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null };
const entry = (id: string) => ({
  questionAssetPaths: [`ib-sl/questions/${id}.webp`],
  markschemeAssetPaths: [`ib-sl/markschemes/${id}.webp`],
  explanationAssetPaths: [`explanations/ib-sl/${id}.json`],
  details,
});

function sign(requests: unknown[]) {
  return POST(new Request("https://pastpaperprep.com/api/assets/sign", {
    method: "POST",
    body: JSON.stringify({ bank: "ib-sl", requests }),
    headers: { "content-type": "application/json" },
  }));
}

function grantAccess(rows: unknown[]) {
  const entitlementQuery = { select: vi.fn(() => entitlementQuery), eq: vi.fn().mockResolvedValue({ data: rows, error: null }) };
  from.mockReturnValue(entitlementQuery);
}

describe("explanation assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");
    loadBankAssetManifest.mockResolvedValue(new Map([[PAID, entry(PAID)], [FREE, entry(FREE)]]));
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });
    grantAccess([{ product_id: "bundle_all", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]);
    rpc.mockImplementation((name: string) => Promise.resolve(name === "get_custom_bundle_access" ? { data: [], error: null } : { data: true, error: null }));
    createClient.mockResolvedValue({ auth: { getClaims }, from, rpc });
    createSignedUrls.mockImplementation(async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://assets.example/${path}` })), error: null }));
    createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrls })) } });
  });

  it("signs a paid explanation from R2 without spending the download allowance", async () => {
    const response = await sign([{ questionId: PAID, kind: "explanation" }]);

    expect(response.status).toBe(200);
    const url = new URL((await response.json()).assets[0].urls[0]);
    expect(url.hostname).toBe("92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com");
    expect(url.pathname).toContain(`explanations/ib-sl/${PAID}.json`);
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("consume_download_allowance", expect.anything());
  });

  it("counts paid explanations against the daily explanation cap", async () => {
    const response = await sign([{ questionId: PAID, kind: "explanation" }]);

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("consume_explanation_allowance", { p_count: 1 });
  });

  it("stops at the daily explanation cap", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(
      name === "get_custom_bundle_access" ? { data: [], error: null } : { data: name !== "consume_explanation_allowance", error: null },
    ));
    const response = await sign([{ questionId: PAID, kind: "explanation" }]);

    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("Daily explanation limit reached. Try again tomorrow.");
  });

  it("does not count free-year explanations against the cap", async () => {
    const response = await sign([{ questionId: FREE, kind: "explanation" }]);

    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalledWith("consume_explanation_allowance", expect.anything());
  });

  it("charges the allowance for the mark scheme only when both are signed together", async () => {
    const response = await sign([{ questionId: PAID, kind: "answer" }, { questionId: PAID, kind: "explanation" }]);

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("consume_explanation_and_download_allowance", { p_count: 1, p_asset_count: 1 });
    expect(rpc).not.toHaveBeenCalledWith("consume_explanation_allowance", expect.anything());
    expect(rpc).not.toHaveBeenCalledWith("consume_download_allowance", expect.anything());
    expect(createSignedUrls).toHaveBeenCalledWith([`ib-sl/markschemes/${PAID}.webp`], 600);
  });

  it("refuses a paid explanation without bank access", async () => {
    grantAccess([]);
    const response = await sign([{ questionId: PAID, kind: "explanation" }]);

    expect(response.status).toBe(403);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("serves a free-year explanation from R2 through the cached free route", async () => {
    const response = await GET(new NextRequest(`https://pastpaperprep.com/api/assets/free?bank=ib-sl&id=${FREE}&kind=explanation`));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=");
    const body = await response.json();
    expect(body.asset.kind).toBe("explanation");
    expect(new URL(body.asset.urls[0]).hostname).toBe("92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com");
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("keeps quota-denied responses private and uncacheable", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(
      name === "get_custom_bundle_access" ? { data: [], error: null } : { data: false, error: null },
    ));
    const response = await sign([{ questionId: PAID, kind: "explanation" }]);
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("keeps provider failures private and uncacheable", async () => {
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    const response = await sign([{ questionId: PAID, kind: "explanation" }]);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(rpc).not.toHaveBeenCalledWith("consume_explanation_allowance", expect.anything());
  });

  it("denies a mixed response with one atomic check and withholds every URL", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(
      name === "get_custom_bundle_access" ? { data: [], error: null } : { data: false, error: null },
    ));
    const response = await sign([{ questionId: PAID, kind: "answer" }, { questionId: PAID, kind: "explanation" }]);
    expect(response.status).toBe(429);
    expect(await response.json()).not.toHaveProperty("assets");
    expect(rpc).toHaveBeenCalledWith("consume_explanation_and_download_allowance", { p_count: 1, p_asset_count: 1 });
    expect(rpc).not.toHaveBeenCalledWith("consume_explanation_allowance", expect.anything());
    expect(rpc).not.toHaveBeenCalledWith("consume_download_allowance", expect.anything());
  });

  it("fails closed when the forward mixed-quota migration is missing", async () => {
    rpc.mockImplementation((name: string) => Promise.resolve(
      name === "get_custom_bundle_access" ? { data: [], error: null } : { data: null, error: { code: "PGRST202" } },
    ));
    const response = await sign([{ questionId: PAID, kind: "answer" }, { questionId: PAID, kind: "explanation" }]);
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("assets");
  });

  it("counts only the paid item in a mixed free/paid explanation response", async () => {
    const response = await sign([{ questionId: FREE, kind: "explanation" }, { questionId: PAID, kind: "explanation" }]);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("consume_explanation_allowance", { p_count: 1 });
    expect(rpc).not.toHaveBeenCalledWith("consume_download_allowance", expect.anything());
  });

  it("serves anonymous free explanations without entitlement or quota RPCs", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const response = await sign([{ questionId: FREE, kind: "explanation" }]);
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("denies anonymous paid explanations before signing or metering", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    const response = await sign([{ questionId: PAID, kind: "explanation" }]);
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("accepts a current manual bank grant", async () => {
    grantAccess([{ product_id: "bank_ib_sl", source: "manual", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]);
    expect((await sign([{ questionId: PAID, kind: "explanation" }])).status).toBe(200);
  });

  it.each([
    { product_id: "bank_ib_hl", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null },
    { product_id: "bank_ib_sl", source: "manual", status: "revoked", starts_at: "2026-01-01T00:00:00Z", expires_at: null },
    { product_id: "bank_ib_sl", source: "manual", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: "2026-01-02T00:00:00Z" },
    { product_id: "bundle_all", status: "active", starts_at: "2099-01-01T00:00:00Z", expires_at: null },
    { product_id: "bundle_custom", source: "manual", selected_bank_ids: ["ib-hl"], status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null },
  ])("denies inactive or wrong-bank grant %# without spending quota", async (grant) => {
    grantAccess([grant]);
    expect((await sign([{ questionId: PAID, kind: "explanation" }])).status).toBe(403);
    expect(rpc.mock.calls.filter(([name]) => name.startsWith("consume_"))).toEqual([]);
  });

  it.each([
    [{ questionId: "../secret", kind: "explanation" }],
    [{ questionId: PAID, kind: "pdf" }],
    [{ questionId: PAID, kind: "explanation" }, { questionId: PAID, kind: "explanation" }],
    Array.from({ length: 21 }, () => ({ questionId: PAID, kind: "explanation" })),
    [],
  ])("rejects malformed/duplicate/oversized batch %# without spending quota", async (...requests) => {
    const response = await sign(requests);
    expect(response.status).toBe(400);
    expect(rpc.mock.calls.filter(([name]) => name.startsWith("consume_"))).toEqual([]);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("ignores client paths and signs only the canonical manifest key", async () => {
    const response = await sign([{ questionId: PAID, kind: "explanation", paths: ["explanations/ib-hl/secret.json"] }]);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(new URL(body.assets[0].urls[0]).pathname).toContain(`explanations/ib-sl/${PAID}.json`);
  });

  it("does not meter an explanation that is absent from the manifest", async () => {
    loadBankAssetManifest.mockResolvedValue(new Map([[PAID, { ...entry(PAID), explanationAssetPaths: [] }]]));
    const response = await sign([{ questionId: PAID, kind: "explanation" }]);
    expect(response.status).toBe(200);
    expect((await response.json()).assets[0].urls).toEqual([]);
    expect(rpc.mock.calls.filter(([name]) => name.startsWith("consume_"))).toEqual([]);
  });

  it("does not spend either quota when mixed signing fails", async () => {
    createSignedUrls.mockResolvedValue({ data: [], error: null });
    const response = await sign([{ questionId: PAID, kind: "answer" }, { questionId: PAID, kind: "explanation" }]);
    expect(response.status).toBe(503);
    expect(rpc.mock.calls.filter(([name]) => name.startsWith("consume_"))).toEqual([]);
  });

  it("keeps paid explanations off the free route", async () => {
    const response = await GET(new NextRequest(`https://pastpaperprep.com/api/assets/free?bank=ib-sl&id=${PAID}&kind=explanation`));
    expect(response.status).toBe(403);
  });
});
