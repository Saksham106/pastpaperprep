import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, createSignedUrls, serverLog } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createSignedUrls: vi.fn(),
  serverLog: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/server-logs", () => ({ serverLog }));

import { signPrivateAssetUrls } from "@/lib/private-assets";

describe("signPrivateAssetUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    createSignedUrls.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://supabase.example/${path}` })),
      error: null,
    }));
    createAdminClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ createSignedUrls })) },
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("logs which store signed which bank's batch, and failures with a scrubbed message", async () => {
    await signPrivateAssetUrls(["ib-economics-hl/questions/q1/question-01.webp", "ib-economics-hl/questions/q1/question-02.webp"], 600, { provider: "supabase" });
    expect(serverLog).toHaveBeenCalledWith("info", "asset_signing", expect.objectContaining({ provider: "supabase", bank: "ib-economics-hl", assets: 2, outcome: "signed", long_lived: false }));
    createSignedUrls.mockResolvedValueOnce({ data: null, error: Object.assign(new Error("Object not found for alice@example.com"), { statusCode: "404" }) });
    await expect(signPrivateAssetUrls(["ib-economics-hl/questions/q1/question-01.webp"], 600, { provider: "supabase" })).rejects.toThrow();
    expect(serverLog).toHaveBeenLastCalledWith("error", "asset_signing", expect.objectContaining({ provider: "supabase", bank: "ib-economics-hl", outcome: "failed", message: undefined }));
    expect(JSON.stringify(serverLog.mock.calls)).not.toMatch(/alice|questions\/q1/);
  });

  it("uses Supabase unless R2 is explicitly enabled", async () => {
    const urls = await signPrivateAssetUrls(["ib-sl/questions/a.webp"], 600);

    expect(urls.get("ib-sl/questions/a.webp")).toBe("https://supabase.example/ib-sl/questions/a.webp");
    expect(createSignedUrls).toHaveBeenCalledWith(["ib-sl/questions/a.webp"], 600);
  });

  it("can force preview assets to Supabase while R2 is enabled", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");

    const urls = await signPrivateAssetUrls(["ib-sl/questions/a.webp"], 600, { provider: "supabase" });

    expect(urls.get("ib-sl/questions/a.webp")).toBe("https://supabase.example/ib-sl/questions/a.webp");
    expect(createSignedUrls).toHaveBeenCalledOnce();
  });

  it("signs R2-only repair crops from R2 inside a Supabase batch, in request order", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");
    const repair = "ib-biology-sl/repairs/ib-shared-stimulus-v1-d53ab265e7e81518/260c5b12.webp";
    const original = "ib-biology-sl/questions/2020-november-tz0-sl-p1-q1-page-3.webp";

    const urls = await signPrivateAssetUrls([repair, original], 600, { provider: "supabase", longLived: true });

    expect([...urls.keys()]).toEqual([repair, original]);
    expect(createSignedUrls).toHaveBeenCalledWith([original], 600);
    expect(new URL(urls.get(repair)!).hostname).toBe("92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com");
    expect(urls.get(original)).toBe(`https://supabase.example/${original}`);

    createSignedUrls.mockClear();
    await signPrivateAssetUrls([repair], 600, { provider: "supabase" });
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("creates private R2 GET URLs for every requested object", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");

    const urls = await signPrivateAssetUrls([
      "igcse/questions/one.webp",
      "ib-hl/answers/two.webp",
    ], 600);

    expect(createAdminClient).not.toHaveBeenCalled();
    expect([...urls.keys()]).toEqual([
      "igcse/questions/one.webp",
      "ib-hl/answers/two.webp",
    ]);
    for (const url of urls.values()) {
      const parsed = new URL(url);
      expect(parsed.protocol).toBe("https:");
      expect(parsed.hostname).toBe("92278648535014b5231edfe207b9391d.r2.cloudflarestorage.com");
      expect(parsed.searchParams.get("X-Amz-Expires")).toBe("600");
      expect(parsed.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    }
  });


  it("signs explanation JSON from R2 with a bounded GET signature", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");
    const path = "explanations/ib-hl/2025-may-tz1-p1-q1.json";
    const urls = await signPrivateAssetUrls([path], 600, { provider: "r2" });
    const url = new URL(urls.get(path)!);
    expect(url.pathname).toBe(`/pastpaperprep-assets/${path}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    "explanations/ib-hl/../secret.json",
    "explanations/ib-hl/%2e%2e%2fsecret.json",
    "/explanations/ib-hl/q1.json",
    "explanations/ib-hl/nested/q1.json",
    "ib-hl/markschemes/q1.json",
    "explanations/ib-hl/q1.json?other=secret",
  ])("rejects noncanonical explanation key %s before contacting any provider", async (path) => {
    await expect(signPrivateAssetUrls([path], 600, { provider: "r2" })).rejects.toThrow("Private asset path is invalid");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("keeps signed links to an hour unless the caller opts into long-lived free links", async () => {
    await expect(signPrivateAssetUrls(["ib-sl/questions/a.webp"], 3601)).rejects.toThrow("Signed URL expiry is invalid");
    await expect(signPrivateAssetUrls(["ib-sl/questions/a.webp"], 604_801, { longLived: true })).rejects.toThrow("Signed URL expiry is invalid");

    await signPrivateAssetUrls(["ib-sl/questions/a.webp"], 604_800, { longLived: true });
    expect(createSignedUrls).toHaveBeenCalledWith(["ib-sl/questions/a.webp"], 604_800);
  });

  it("signs week-long R2 links when asked, reusing one client per configuration", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");
    vi.stubEnv("R2_ACCESS_KEY_ID", "a".repeat(32));
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "b".repeat(64));
    vi.stubEnv("R2_BUCKET_NAME", "pastpaperprep-assets");

    const first = await signPrivateAssetUrls(["igcse/questions/one.webp"], 604_800, { longLived: true });
    const second = await signPrivateAssetUrls(["igcse/questions/two.webp"], 600);

    expect(new URL(first.get("igcse/questions/one.webp")!).searchParams.get("X-Amz-Expires")).toBe("604800");
    expect(new URL(second.get("igcse/questions/two.webp")!).searchParams.get("X-Amz-Expires")).toBe("600");
  });

  it("fails closed when R2 configuration is incomplete", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "92278648535014b5231edfe207b9391d");

    await expect(signPrivateAssetUrls(["igcse/questions/one.webp"], 600))
      .rejects.toThrow("R2 configuration is incomplete");
  });

  it("rejects unknown providers instead of silently falling back", async () => {
    vi.stubEnv("ASSET_STORAGE_PROVIDER", "other");

    await expect(signPrivateAssetUrls(["igcse/questions/one.webp"], 600))
      .rejects.toThrow("Unsupported asset storage provider");
  });
});
