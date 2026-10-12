import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
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

  it.each(["probability-distributions-mixed-exam-practice", "sets-venn-conditional-probability"])("denies anonymous requests for %s without exposing any PDF bytes", async (slug) => {
    const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ course: "ib-math-aa-sl", slug }) });
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

  it.each([
    ["indices", "9bb69373656156f5ff1de2f865cb2a4f6754c39ca9bb1aab22c9de32e6c5e7c8"],
    ["advanced-trigonometry", "e11f9c33a00a31bf317040934208f783f1dca82f3769c5c8b2ffeff2a42de6f2"],
  ])("serves the exact updated 0580 %s PDF only after authentication", async (slug, sha256) => {
    const params = { params: Promise.resolve({ course: "igcse-0580", slug }) };
    const anonymous = await GET(new Request("https://example.test"), params);
    expect(anonymous.status).toBe(401);
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });
    const response = await GET(new Request("https://example.test"), params);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(`inline; filename="${slug}.pdf"`);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex")).toBe(sha256);
  });

  it("serves the exact imported sets and conditional probability worksheet", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });
    const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ course: "ib-math-aa-sl", slug: "sets-venn-conditional-probability" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="sets-venn-conditional-probability.pdf"');
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex")).toBe("0cb3b18be403568b7444b1492d7b09859b3104e7391845ace9f0b46d64ae9fdf");
  });
});
