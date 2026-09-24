import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims, signExamStyleTrigonometryPdf } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  signExamStyleTrigonometryPdf: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/exam-style-trigonometry-server", () => ({ signExamStyleTrigonometryPdf }));

import { GET } from "./route";

const request = new Request("https://pastpaperprep.com/api/exam-style/trigonometry/trigonometric-graphs");
const context = { params: Promise.resolve({ slug: "trigonometric-graphs" }) };

describe("GET /api/exam-style/trigonometry/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: {} } });
    createClient.mockResolvedValue({ auth: { getClaims } });
    signExamStyleTrigonometryPdf.mockResolvedValue("https://assets.example/signed.pdf");
  });

  it("refuses to sign practice PDFs for anonymous visitors", async () => {
    const response = await GET(request, context);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ error: "Sign in required" });
    expect(signExamStyleTrigonometryPdf).not.toHaveBeenCalled();
  });

  it("redirects authenticated users to the signed inline PDF", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });

    const response = await GET(request, context);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://assets.example/signed.pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(signExamStyleTrigonometryPdf).toHaveBeenCalledWith("trigonometric-graphs");
  });

  it("does not sign unknown sets for authenticated users", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });

    const response = await GET(request, { params: Promise.resolve({ slug: "not-a-set" }) });

    expect(response.status).toBe(404);
    expect(signExamStyleTrigonometryPdf).not.toHaveBeenCalled();
  });
});
