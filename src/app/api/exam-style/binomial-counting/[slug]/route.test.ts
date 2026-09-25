import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims } }) }));
import { GET } from "./route";

const request = new Request("https://pastpaperprep.com/api/exam-style/binomial-counting/binomial");
const context = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("binomial theorem and counting PDF access", () => {
  beforeEach(() => getClaims.mockReset());
  it("returns 404 for unknown slugs without checking auth or reading files", async () => {
    const response = await GET(request, context("../secrets"));
    expect(response.status).toBe(404);
    expect(getClaims).not.toHaveBeenCalled();
  });
  it("requires authenticated claims for every allowlisted PDF", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    for (const slug of ["binomial", "counting"]) {
      const response = await GET(request, context(slug));
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    }
  });
  it("serves original PDFs inline to authenticated users without public caching", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "test-user" } } });
    for (const [slug, fileName] of [["binomial", "binomial.pdf"], ["counting", "counting.pdf"]]) {
      const response = await GET(request, context(slug));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Disposition")).toBe(`inline; filename="${fileName}"`);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(new TextDecoder().decode(new Uint8Array(await response.arrayBuffer()).subarray(0, 5))).toBe("%PDF-");
    }
  });
});
