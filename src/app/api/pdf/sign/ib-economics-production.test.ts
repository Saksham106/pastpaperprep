import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims, from, rpc, createSignedUrls } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ storage: { from: () => ({ createSignedUrls }) } }) }));

import { POST } from "@/app/api/pdf/sign/route";

function request(body: unknown) {
  return new Request("https://pastpaperprep.com/api/pdf/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("IB Economics production PDF entitlement and quota gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "supabase");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "true");
    vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "true");
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });
    const entitlementQuery = {
      select: vi.fn(() => entitlementQuery),
      eq: vi.fn().mockResolvedValue({ data: [{ product_id: "bank_ib_economics_hl", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }], error: null }),
    };
    from.mockReturnValue(entitlementQuery);
    rpc.mockImplementation(async (name: string) => ({ data: name === "get_custom_bundle_access" ? [] : true, error: null }));
    createClient.mockResolvedValue({ auth: { getClaims }, from, rpc });
    createSignedUrls.mockImplementation(async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://assets.example/${path}` })), error: null }));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("denies a locked Economics bank before signing or quota consumption", async () => {
    from.mockReturnValueOnce({
      select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    });
    const response = await POST(request({ bank: "ib-economics-hl", questionIds: ["2021-may-none-hl-p2-q01"], content: "questions" }));
    expect(response.status).toBe(403);
    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_custom_bundle_access", { p_user_id: "user-id" });
  });

  it("signs an entitled Economics export and consumes exact quota counts", async () => {
    // 2025 is a paid year for IB Economics; 2021 is the explicit free year, so a paid
    // export must be asserted on a non-preview question.
    const response = await POST(request({ bank: "ib-economics-hl", questionIds: ["2025-may-none-hl-p3-q01"], content: "questions" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(createSignedUrls).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("consume_download_allowance", { p_asset_count: 7, p_pdf_question_count: 1 });
  });

  it("does not charge the paid allowance for the explicit free exam year", async () => {
    const response = await POST(request({ bank: "ib-economics-hl", questionIds: ["2021-may-none-hl-p2-q01"], content: "questions" }));
    expect(response.status).toBe(200);
    expect(createSignedUrls).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("consume_download_allowance", { p_asset_count: 0, p_pdf_question_count: 1 });
  });

  it("fails closed on exhausted Economics PDF quota without returning assets", async () => {
    rpc.mockImplementationOnce(async () => ({ data: [], error: null })).mockResolvedValueOnce({ data: false, error: null });
    const response = await POST(request({ bank: "ib-economics-hl", questionIds: ["2025-may-none-hl-p3-q01"], content: "questions" }));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "Daily worksheet limit reached. Try again tomorrow." });
  });
});
