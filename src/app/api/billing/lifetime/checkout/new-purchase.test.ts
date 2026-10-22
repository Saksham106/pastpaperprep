import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  access: vi.fn(),
  subscriptionsList: vi.fn(),
  sessionsList: vi.fn(),
  sessionsCreate: vi.fn(),
  sessionsExpire: vi.fn(),
  conversion: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/route-failure-reporting", () => ({ withFailureReporting: (_route: string, handler: unknown) => handler }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user_1", email: "u@example.com" } } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: m.access }));
vi.mock("@/lib/lifetime-conversion-checkout", () => ({ createLifetimeConversionCheckout: m.conversion }));
vi.mock("@/lib/stripe-config", () => ({ getStripeConfig: () => ({ secretKey: "test-fixture", siteUrl: "https://example.test" }), isStripeBillingEnabled: () => true }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({
  subscriptions: { list: m.subscriptionsList },
  checkout: { sessions: { list: m.sessionsList, create: m.sessionsCreate, expire: m.sessionsExpire } },
}) }));

import { POST } from "@/app/api/billing/lifetime/checkout/route";

describe("POST /api/billing/lifetime/checkout for a new buyer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.access.mockResolvedValue({ rows: [], error: null });
    m.rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id"
      ? { data: "cus_1", error: null }
      : ["reserve_billing_checkout", "confirm_billing_checkout", "release_billing_checkout"].includes(name)
        ? { data: true, error: null }
        : { data: null, error: Error(name) });
    m.subscriptionsList.mockResolvedValue({ data: [], has_more: false });
    m.sessionsList.mockResolvedValue({ data: [], has_more: false });
    m.sessionsCreate.mockResolvedValue({ id: "cs_life", url: "https://checkout.stripe.com/c/pay/cs_life" });
  });

  it("releases the reservation once the session exists so the buyer can back out and choose a plan", async () => {
    const response = await (POST as unknown as () => Promise<Response>)();

    expect(response.status).toBe(200);
    const reserve = m.rpc.mock.calls.find(([name]) => name === "reserve_billing_checkout");
    const releaseIndex = m.rpc.mock.calls.findIndex(([name]) => name === "release_billing_checkout");
    expect(m.rpc.mock.calls[releaseIndex]?.[1]).toEqual({ p_user_id: "user_1", p_intent_id: reserve?.[1]?.p_intent_id });
    expect(m.rpc.mock.invocationCallOrder[releaseIndex]).toBeGreaterThan(m.sessionsCreate.mock.invocationCallOrder[0]);
  });

  it("keeps the reservation when Stripe session creation has an uncertain result", async () => {
    m.sessionsCreate.mockRejectedValue(Error("timeout"));

    const response = await (POST as unknown as () => Promise<Response>)();

    expect(response.status).toBe(503);
    expect(m.rpc).not.toHaveBeenCalledWith("release_billing_checkout", expect.anything());
  });
});
