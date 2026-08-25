import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const getUser = vi.fn();
const userFrom = vi.fn();
const adminFrom = vi.fn();
const portalCreate = vi.fn();
let billingEnabled = true;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from: userFrom })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: adminFrom })),
}));
vi.mock("@/lib/stripe", () => ({
  createStripeClient: vi.fn(() => ({ billingPortal: { sessions: { create: portalCreate } } })),
}));
vi.mock("@/lib/stripe-config", () => ({
  isStripeBillingEnabled: () => billingEnabled,
  getStripeConfig: () => ({ secretKey: "sk_test_example", siteUrl: "https://pastpaperprep.com" }),
}));

import { POST } from "@/app/api/billing/portal/route";

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingEnabled = true;
  });

  it("rejects unauthenticated users", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await POST();
    expect(response.status).toBe(401);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("rejects direct portal calls while billing is disabled", async () => {
    billingEnabled = false;
    getUser.mockResolvedValue({ data: { user: { id: "user-id" } } });

    const response = await POST();
    expect(response.status).toBe(503);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("fails closed when the authenticated user has no mapped customer", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-id" } } });
    adminFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) });

    const response = await POST();
    expect(response.status).toBe(404);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("creates a portal session only for the server-mapped customer", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-id" } } });
    adminFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { customer_id: "cus_mapped" }, error: null }) }) }) });
    portalCreate.mockResolvedValue({ url: "https://billing.stripe.com/session" });

    const response = await POST();
    expect(response.status).toBe(200);
    expect(userFrom).not.toHaveBeenCalled();
    expect(adminFrom).toHaveBeenCalledWith("stripe_customers");
    await expect(response.json()).resolves.toEqual({ url: "https://billing.stripe.com/session" });
    expect(portalCreate).toHaveBeenCalledWith({
      customer: "cus_mapped",
      return_url: "https://pastpaperprep.com/account",
    });
  });
});
