import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), access: vi.fn(), read: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.getClaims } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.access }));
vi.mock("@/lib/helper/allowance", () => ({ readHelperCredits: mocks.read }));

import { GET } from "@/app/api/helper/credits/route";

describe("GET /api/helper/credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    mocks.access.mockResolvedValue({ rows: [], error: null });
    mocks.read.mockResolvedValue({ tier: "free", weekly: 150, planLeft: 130, packLeft: 0, resetsAt: "2026-11-30T00:00:00.000Z", packs: [] });
  });

  it("returns the signed-in student's balance for their tier, never cached", async () => {
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({ credits: { tier: "free", weekly: 150, planLeft: 130, packLeft: 0, resetsAt: "2026-11-30T00:00:00.000Z" }, packs: [] });
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), "user-1", "free");
  });

  it("needs a sign-in and fails closed when access or the balance can't be read", async () => {
    mocks.getClaims.mockResolvedValueOnce({ data: { claims: null } });
    expect((await GET()).status).toBe(401);
    mocks.access.mockResolvedValueOnce({ rows: [], error: new Error("db") });
    expect((await GET()).status).toBe(503);
    mocks.read.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(503);
  });
});
