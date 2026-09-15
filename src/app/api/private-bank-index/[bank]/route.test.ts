import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const context = { params: Promise.resolve({ bank: "ib-economics-hl" }) };

afterEach(() => vi.unstubAllEnvs());

/**
 * Root cause this endpoint used to carry: it required a session, returned 401 logged out,
 * and therefore left every advertised `?free=1` private-bank link with an empty question
 * list. The index is metadata-only, so it is now served anonymously; the actual content
 * stays entitlement-protected in /api/assets/sign, /api/pdf/sign, and the delivery
 * projection. These tests pin both halves of that contract.
 */
describe("private bank metadata index", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "true");
    vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "true");
  });

  it("serves the metadata-only index to an anonymous visitor", async () => {
    const response = await GET(new Request("https://pastpaperprep.com/api/private-bank-index/ib-economics-hl"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    const payload = await response.json() as { version: number; bank: string; questions: unknown[] };
    expect(payload.version).toBe(1);
    expect(payload.bank).toBe("ib-economics-hl");
    expect(payload.questions.length).toBeGreaterThan(24);
  });

  it("returns only protected-safe metadata", async () => {
    const response = await GET(new Request("https://pastpaperprep.com/api/private-bank-index/ib-economics-hl"), context);
    const serialized = JSON.stringify(await response.json());
    for (const key of ["accessibleText", "summary", "solution", "sourceQuestionUrl", "sourceMarkSchemeUrl", "questionImages", "markschemeImages", "questionAssetPaths", "markschemeAssetPaths", "classificationEvidence", "classificationProvenance", "answer"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).not.toContain(".webp");
    expect(serialized).not.toContain("https://");
  });

  it("stays unavailable while the bank's release gate is off", async () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "false");
    const response = await GET(new Request("https://pastpaperprep.com/api/private-bank-index/ib-economics-hl"), context);
    expect(response.status).toBe(404);
  });

  it("refuses a non-private bank", async () => {
    const response = await GET(new Request("https://pastpaperprep.com/api/private-bank-index/igcse"), {
      params: Promise.resolve({ bank: "igcse" }),
    });
    expect(response.status).toBe(404);
  });
});
