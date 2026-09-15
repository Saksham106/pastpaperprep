import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, hasSupabaseAuthCookie } = vi.hoisted(() => ({
  createClient: vi.fn(),
  hasSupabaseAuthCookie: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/supabase/proxy", () => ({ hasSupabaseAuthCookie }));

import { NextRequest } from "next/server";
import { GET } from "./route";

function table(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  return chain;
}

describe("bank member bootstrap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns anonymous access without creating a Supabase client when there is no auth cookie", async () => {
    hasSupabaseAuthCookie.mockReturnValue(false);

    const response = await GET(new NextRequest("https://pastpaperprep.com/api/banks/bootstrap?bank=ib-sl"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toEqual({
      access: { authenticated: false, bankAccess: false, canExportPdf: false },
      studyState: { savedIds: [], attemptedIds: [] },
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns authenticated entitlements and study state without exposing the user id", async () => {
    hasSupabaseAuthCookie.mockReturnValue(true);
    const tables = {
      entitlements: table([{ product_id: "bank_ib_sl", selected_bank_ids: null, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]),
      saved_questions: table([{ question_id: "saved-1" }]),
      attempts: table([{ question_id: "attempted-1" }]),
    };
    createClient.mockResolvedValue({
      auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "user-secret-id" } } })) },
      from: vi.fn((name: keyof typeof tables) => tables[name]),
    });

    const response = await GET(new NextRequest("https://pastpaperprep.com/api/banks/bootstrap?bank=ib-sl"));
    const body = await response.json();

    expect(body.access).toEqual({ authenticated: true, bankAccess: true, canExportPdf: true });
    expect(body.studyState).toEqual({ savedIds: ["saved-1"], attemptedIds: ["attempted-1"] });
    expect(body.exportMarker).toMatch(/^[A-F0-9]{10}$/);
    expect(JSON.stringify(body)).not.toContain("user-secret-id");
  });

  it("preserves verified access but reports unavailable study state", async () => {
    hasSupabaseAuthCookie.mockReturnValue(true);
    const tables = {
      entitlements: table([{ product_id: "bank_ib_sl", selected_bank_ids: null, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null }]),
      saved_questions: table(null, { message: "saved unavailable" }),
      attempts: table(null, { message: "attempts unavailable" }),
    };
    createClient.mockResolvedValue({
      auth: { getClaims: vi.fn(async () => ({ data: { claims: { sub: "user-secret-id" } } })) },
      from: vi.fn((name: keyof typeof tables) => tables[name]),
    });

    const response = await GET(new NextRequest("https://pastpaperprep.com/api/banks/bootstrap?bank=ib-sl"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.access.bankAccess).toBe(true);
    expect(body.studyState).toEqual({ savedIds: [], attemptedIds: [] });
    expect(body.studyStateUnavailable).toBe(true);
  });
});
