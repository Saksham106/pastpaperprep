import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  fetchAccessEntitlements: vi.fn(),
  captureServerException: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.fetchAccessEntitlements }));
vi.mock("@/lib/server-error-tracking", () => ({ captureServerException: mocks.captureServerException }));

import { GET } from "./route";

const SESSION_COOKIE = "sb-project-auth-token=base64-eyJ9";
const request = (cookie?: string) => new NextRequest("https://pastpaperprep.com/api/pricing/account", { headers: cookie ? { cookie } : {} });
const row = (productId: string, source: "stripe" | "manual", name: string, expiresAt: string | null = null) =>
  ({ productId, status: "active", startsAt: "2025-01-01T00:00:00.000Z", expiresAt, source, products: { name } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ auth: { getClaims: mocks.getClaims } });
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "owner" } } });
  mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
});

describe("GET /api/pricing/account", () => {
  it("answers anonymous visitors without touching Supabase, privately", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toMatchObject({ authenticated: false, hasPaidAccess: false, ownedBankIds: [] });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetchAccessEntitlements).not.toHaveBeenCalled();
  });

  it("treats a cookie whose session no longer verifies as signed out", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });
    const response = await GET(request(SESSION_COOKIE));
    expect(await response.json()).toMatchObject({ authenticated: false, hasPaidAccess: false });
    expect(mocks.fetchAccessEntitlements).not.toHaveBeenCalled();
  });

  it("reads entitlements only for the verified session's user", async () => {
    await GET(request(SESSION_COOKIE));
    expect(mocks.fetchAccessEntitlements).toHaveBeenCalledWith(expect.anything(), "owner");
  });

  it("reports a signed-in free account", async () => {
    const response = await GET(request(SESSION_COOKIE));
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({
      authenticated: true, hasPaidAccess: false, ownedBankIds: [], currentPlanNames: [], currentPlanProductIds: [], complimentaryAccess: false, manualAccess: false,
    });
  });

  it("reports a paid subscriber's owned banks and plan", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [row("bank_ib_sl", "stripe", "IB Mathematics AA SL")], error: null });
    expect(await (await GET(request(SESSION_COOKIE))).json()).toEqual({
      authenticated: true, hasPaidAccess: true, ownedBankIds: ["ib-sl"], currentPlanNames: ["IB Mathematics AA SL"], currentPlanProductIds: ["bank_ib_sl"], complimentaryAccess: false, manualAccess: false,
    });
  });

  it("reports a manual All Access grant as complimentary, not billed", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [row("bundle_all", "manual", "All Access")], error: null });
    const body = await (await GET(request(SESSION_COOKIE))).json();
    expect(body).toMatchObject({ hasPaidAccess: true, complimentaryAccess: true, manualAccess: true, currentPlanProductIds: ["bundle_all"] });
  });

  it("keeps a separately active Stripe plan billable beside a manual grant", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [row("bundle_all", "manual", "All Access"), row("bank_igcse", "stripe", "IGCSE Mathematics")], error: null });
    const body = await (await GET(request(SESSION_COOKIE))).json();
    expect(body).toMatchObject({ hasPaidAccess: true, complimentaryAccess: false, manualAccess: false });
  });

  it("does not count an expired entitlement as current access", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [row("bank_ib_sl", "stripe", "IB Mathematics AA SL", "2025-02-01T00:00:00.000Z")], error: null });
    expect(await (await GET(request(SESSION_COOKIE))).json()).toMatchObject({ hasPaidAccess: false, ownedBankIds: [], currentPlanProductIds: [] });
  });

  it("returns a retryable 503 and reports PGRST303 instead of guessing access", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: { code: "PGRST303", message: "JWT issued at future" } });
    const response = await GET(request(SESSION_COOKIE));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({ error: "access_check_delayed" });
    expect(mocks.captureServerException).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ route: "/pricing", stage: "entitlement", error_code: "PGRST303", user_id: "owner" }));
  });

  it("does not hide unrelated access errors behind the delayed-check response", async () => {
    const denied = { code: "42501", message: "permission denied" };
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: denied });
    await expect(GET(request(SESSION_COOKIE))).rejects.toEqual(denied);
  });

  it("does not mistake a different PGRST303 failure for the clock bug", async () => {
    const failure = { code: "PGRST303", message: "JWT expired" };
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: failure });
    await expect(GET(request(SESSION_COOKIE))).rejects.toEqual(failure);
  });
});
