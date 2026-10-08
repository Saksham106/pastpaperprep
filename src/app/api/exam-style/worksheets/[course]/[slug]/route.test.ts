import { beforeEach, describe, expect, it, vi } from "vitest";
const { createClient, getClaims } = vi.hoisted(() => ({ createClient: vi.fn(), getClaims: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
import { GET } from "./route";

const context = { params: Promise.resolve({ course: "ib-math-aa-sl", slug: "probability-distributions-mixed-exam-practice" }) };

describe("GET /api/exam-style/worksheets/[course]/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: {} } });
    createClient.mockResolvedValue({ auth: { getClaims } });
  });

  it("denies anonymous requests without exposing any PDF bytes", async () => {
    const response = await GET(new Request("https://example.test"), context);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({ error: "Sign in required" });
  });

  it("serves the allowlisted PDF privately for authenticated accounts", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });
    const response = await GET(new Request("https://example.test"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("probability-distributions-mixed-exam-practice.pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-length")).toBeNull();
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("rejects unknown courses and worksheet slugs", async () => {
    expect((await GET(new Request("https://example.test"), { params: Promise.resolve({ course: "../../public", slug: "foo" }) })).status).toBe(404);
    expect((await GET(new Request("https://example.test"), { params: Promise.resolve({ course: "igcse-0580", slug: "not-registered" }) })).status).toBe(404);
    expect(createClient).not.toHaveBeenCalled();
  });
});
