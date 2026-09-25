import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims } }) }));
import { GET } from "./route";

const request = new Request("https://pastpaperprep.com/api/exam-style/proof-by-induction/divisibility");
const context = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("proof by induction PDF access", () => {
  beforeEach(() => getClaims.mockReset());
  it("returns 404 for unknown slugs without checking auth or reading files", async () => {
    const response = await GET(request, context("../secrets"));
    expect(response.status).toBe(404);
    expect(getClaims).not.toHaveBeenCalled();
  });
  it("requires authenticated claims for every PDF", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    for (const slug of ["divisibility", "sequences", "inequalities", "binomial", "counting"]) {
      const response = await GET(request, context(slug));
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    }
  });
  it("serves original PDFs inline to an authenticated user without public caching", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "test-user" } } });
    for (const slug of ["divisibility", "sequences", "inequalities", "binomial", "counting"]) {
      const response = await GET(request, context(slug));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Disposition")).toBe(`inline; filename="${slug}.pdf"`);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe("%PDF-");
    }
  });
});
