import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AssetManifest, AssetManifestEntry } from "@/lib/asset-manifest";

// MCQ letters travel only on authorized answer assets. These cases pin the gate on both
// delivery routes against a fixed manifest, so they hold whichever runtime mode CI builds.
const { createClient, createAdminClient, getClaims, from, rpc, createSignedUrls, manifestFor } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  createSignedUrls: vi.fn(),
  manifestFor: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/asset-manifest", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/asset-manifest")>(),
  loadBankAssetManifest: manifestFor,
}));

import { POST as signPOST } from "@/app/api/assets/sign/route";
import { GET as freeGET } from "@/app/api/assets/free/route";

const BANK = "igcse-chemistry-0620";
const FREE_MCQ = "0620-2021-m-12-q1"; // 2021 is the bank's free year
const PAID_MCQ = "0620-2025-m-12-q1";
const PAID_WRITTEN = "0620-2025-m-42-q1";
const details = { summary: "s", accessibleText: "a", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null };
const entry = (id: string, letter?: "A" | "D"): AssetManifestEntry => ({
  questionAssetPaths: [`${BANK}/questions/${id}.webp`],
  markschemeAssetPaths: [`${BANK}/markschemes/${id}.webp`],
  ...(letter ? { mcqAnswer: { answers: [letter], note: null } } : {}),
  details,
});
const manifest: AssetManifest = new Map([
  [FREE_MCQ, entry(FREE_MCQ, "D")],
  [PAID_MCQ, entry(PAID_MCQ, "A")],
  [PAID_WRITTEN, entry(PAID_WRITTEN)],
]);

function entitle(productId: string | null) {
  getClaims.mockResolvedValue({ data: { claims: productId ? { sub: "user-id" } : null } });
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn().mockResolvedValue({ data: productId ? [{ product_id: productId, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }] : [], error: null }),
  };
  from.mockReturnValue(query);
}

const sign = (requests: unknown) => signPOST(new Request("https://pastpaperprep.com/api/assets/sign", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ bank: BANK, requests }),
}));
const free = (id: string, kind: string) => freeGET(new NextRequest(`https://pastpaperprep.com/api/assets/free?bank=${BANK}&id=${id}&kind=${kind}`));

describe("MCQ letter delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS", "true");
    vi.stubEnv("PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED", "true");
    // Release banks presign through R2; these are format-valid placeholders, signed locally.
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");
    manifestFor.mockResolvedValue(manifest);
    rpc.mockImplementation((name: string) => Promise.resolve(name === "get_custom_bundle_access" ? { data: [], error: null } : { data: true, error: null }));
    createClient.mockResolvedValue({ auth: { getClaims }, from, rpc });
    createSignedUrls.mockImplementation(async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://assets.example/${path}` })), error: null }));
    createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrls })) } });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sign route: an anonymous visitor gets no letter for a paid MCQ", async () => {
    entitle(null);
    const response = await sign([{ questionId: PAID_MCQ, kind: "answer" }]);
    expect(response.status).toBe(403);
    const text = await response.text();
    expect(text).not.toContain("mcqAnswer");
    expect(text).not.toContain("answers");
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("sign route: a member of another bank gets no letter", async () => {
    entitle("bank_igcse");
    const response = await sign([{ questionId: PAID_MCQ, kind: "answer" }]);
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("mcqAnswer");
  });

  it("sign route: a member gets the letter instead of the crop, without spending the image allowance", async () => {
    entitle("bundle_all");
    const response = await sign([{ questionId: PAID_MCQ, kind: "answer" }]);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    const payload = await response.json();
    expect(payload.assets).toEqual([expect.objectContaining({ questionId: PAID_MCQ, kind: "answer", urls: [], mcqAnswer: { answers: ["A"], note: null } })]);
    expect(rpc).not.toHaveBeenCalledWith("consume_download_allowance", expect.anything());
  });

  it("sign route: question images and written answers never carry a letter", async () => {
    entitle("bundle_all");
    const response = await sign([
      { questionId: PAID_MCQ, kind: "question" },
      { questionId: PAID_WRITTEN, kind: "answer" },
    ]);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.assets.map((asset: Record<string, unknown>) => asset.mcqAnswer)).toEqual([undefined, undefined]);
    expect(payload.assets[0].urls).toEqual([expect.stringContaining(`/questions/${PAID_MCQ}.webp`)]);
    expect(payload.assets[1].urls).toEqual([expect.stringContaining(`/markschemes/${PAID_WRITTEN}.webp`)]);
  });

  it("free route: a free-year MCQ answer is the letter, shared through the CDN", async () => {
    const response = await free(FREE_MCQ, "answer");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/^public, /);
    const payload = await response.json();
    expect(payload.asset).toEqual(expect.objectContaining({ questionId: FREE_MCQ, kind: "answer", urls: [], mcqAnswer: { answers: ["D"], note: null } }));
    expect(createClient).not.toHaveBeenCalled();
  });

  it("free route: a paid-year MCQ is refused without a letter, and a free question image has none", async () => {
    const paid = await free(PAID_MCQ, "answer");
    expect(paid.status).toBe(403);
    expect(await paid.text()).not.toContain("mcqAnswer");
    const question = await free(FREE_MCQ, "question");
    expect(question.status).toBe(200);
    expect((await question.json()).asset.mcqAnswer).toBeUndefined();
  });
});
