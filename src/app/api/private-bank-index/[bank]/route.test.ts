import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims, from } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "./route";

const context = { params: Promise.resolve({ bank: "ib-economics-hl" }) };

afterEach(() => vi.unstubAllEnvs());

describe("private Economics bank index", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "true");
    vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "true");
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });
    createClient.mockResolvedValue({ auth: { getClaims }, from });
  });

  it("denies the candidate index without an active entitlement", async () => {
    from.mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) });
    const response = await GET(new Request("https://pastpaperprep.com/api/private-bank-index/ib-economics-hl"), context);
    expect(response.status).toBe(403);
  });

  it("returns only protected-safe metadata to an entitled user", async () => {
    from.mockReturnValue({
      select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [{ product_id: "bank_ib_economics_hl", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }], error: null }) })),
    });
    const response = await GET(new Request("https://pastpaperprep.com/api/private-bank-index/ib-economics-hl"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    const serialized = JSON.stringify(await response.json());
    for (const key of ["accessibleText", "summary", "solution", "sourceQuestionUrl", "sourceMarkSchemeUrl", "questionImages", "markschemeImages", "questionAssetPaths", "markschemeAssetPaths", "classificationEvidence", "classificationProvenance"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
  });
});
