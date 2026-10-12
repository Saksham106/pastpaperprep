import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getSignedUrl, createAdminClient, getClaims, rpc } = vi.hoisted(() => ({
  getSignedUrl: vi.fn(), createAdminClient: vi.fn(), getClaims: vi.fn(), rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims }, rpc }) }));
vi.mock("@/lib/asset-manifest", async (original) => {
  const actual = await original<typeof import("@/lib/asset-manifest")>();
  return { ...actual, loadBankAssetManifest: async (bank: string) => {
    const level = bank === "ib-economics-hl" ? "hl" : "sl";
    const id = `2021-may-none-${level}-p2-q01`;
    return new Map([[id, {
      questionAssetPaths: [`${bank}/questions/${id}/question-01.webp`],
      markschemeAssetPaths: [`${bank}/markschemes/${id}/markscheme-01.webp`],
      details: { summary: "", accessibleText: "", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null },
    }]]);
  } };
});
vi.mock("@/lib/question-delivery", () => ({ richDetailsFor: () => ({ summary: "", accessibleText: "", solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null }) }));

import { GET } from "./route";
import { POST } from "../sign/route";
import { FREE_ASSET_EXPIRES_IN } from "@/lib/signed-assets";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
  vi.stubEnv("R2_ACCOUNT_ID", "a".repeat(32));
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-access");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
  vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");
  vi.stubEnv("ASSET_STORAGE_PROVIDER", "supabase");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "true");
  vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "true");
  getClaims.mockResolvedValue({ data: { claims: null } });
  getSignedUrl.mockImplementation(async (_client: unknown, command: { input: { Key: string } }) => `https://r2.example/${command.input.Key}`);
  createAdminClient.mockImplementation(() => { throw new Error("Economics has no retained Supabase copy"); });
});
afterEach(() => vi.unstubAllEnvs());

describe("Economics preview signing uses the verified object store", () => {
  for (const [bank, level] of [["ib-economics-hl", "hl"], ["ib-economics-sl", "sl"]] as const) {
    it.each(["question", "answer"] as const)(`serves ${bank} free %s through R2 without a session`, async (kind) => {
      const id = `2021-may-none-${level}-p2-q01`;
      const query = new URLSearchParams({ bank, id, kind });
      const response = await GET(new NextRequest(`https://app.test/api/assets/free?${query}`));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.asset).toMatchObject({ questionId: id, kind, urls: [expect.stringContaining(`https://r2.example/${bank}/`)] });
      expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ input: expect.objectContaining({ Bucket: "pastpaperprep-assets" }) }), { expiresIn: FREE_ASSET_EXPIRES_IN });
      expect(createAdminClient).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    });

    it.each(["question", "answer"] as const)(`keeps ${bank} free %s on the legacy POST signer working`, async (kind) => {
      const response = await POST(new Request("https://app.test/api/assets/sign", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bank, requests: [{ questionId: `2021-may-none-${level}-p2-q01`, kind }] }),
      }));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.assets[0].urls).toEqual([expect.stringContaining(`https://r2.example/${bank}/`)]);
      expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 600 });
      expect(createAdminClient).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    });
  }
});
