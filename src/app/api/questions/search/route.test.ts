import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadBankQuestions as loadFixtureQuestions } from "@/lib/question-fixtures";

const { createClient, getClaims, from, loadBankQuestions } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  from: vi.fn(),
  loadBankQuestions: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/question-loader", () => ({ loadBankQuestions }));

import { GET } from "@/app/api/questions/search/route";

function request(query: string): Request {
  return new Request(`https://pastpaperprep.com/api/questions/search?bank=ib-sl&q=${encodeURIComponent(query)}`);
}

describe("GET /api/questions/search", () => {
  const source = loadFixtureQuestions("ib-sl").find((question) => question.year !== 2017)!;
  const richQuestion = { ...source, searchText: "metadata protected theorem phrase" };

  beforeEach(() => {
    vi.clearAllMocks();
    loadBankQuestions.mockResolvedValue([richQuestion]);
    getClaims.mockResolvedValue({ data: { claims: {} } });
    const entitlementQuery = {
      select: vi.fn(() => entitlementQuery),
      eq: vi.fn().mockResolvedValue({ data: [{ product_id: "bank_ib_sl", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }], error: null }),
    };
    from.mockReturnValue(entitlementQuery);
    createClient.mockResolvedValue({ auth: { getClaims }, from });
  });

  it("returns matching IDs for rich authorized search and no rich payload", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-id" } } });
    const response = await GET(request("protected theorem"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ ids: [richQuestion.id] });
    expect(payload).not.toHaveProperty("accessibleText");
    expect(JSON.stringify(payload)).not.toContain("protected theorem");
  });

  it("searches locked questions with metadata only for anonymous users", async () => {
    const response = await GET(request("protected theorem"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ids: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects empty queries and invalid banks without loading protected data", async () => {
    const empty = await GET(request("   "));
    const invalid = await GET(new Request("https://pastpaperprep.com/api/questions/search?bank=other&q=term"));

    expect(empty.status).toBe(400);
    expect(invalid.status).toBe(400);
    expect(loadBankQuestions).not.toHaveBeenCalled();
  });
});
