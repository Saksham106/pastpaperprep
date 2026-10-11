import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, createSignedUrls } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

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
