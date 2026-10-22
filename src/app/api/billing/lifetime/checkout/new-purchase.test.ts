import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  access: vi.fn(),
  subscriptionsList: vi.fn(),
  sessionsList: vi.fn(),
  sessionsCreate: vi.fn(),
  sessionsExpire: vi.fn(),
  listLineItems: vi.fn(),
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
  checkout: { sessions: { list: m.sessionsList, create: m.sessionsCreate, expire: m.sessionsExpire, listLineItems: m.listLineItems } },
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
    m.sessionsExpire.mockImplementation(async (id: string) => ({ id, status: "expired" }));
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

  const subscriptionCheckout = { id: "cs_one_bank", mode: "subscription", status: "open", url: "https://checkout.stripe.com/c/pay/cs_one_bank", metadata: { user_id: "user_1", product_id: "bank_ib_sl" } };
  const sessionsByStatus = (byStatus: Record<string, unknown[]>) => m.sessionsList.mockImplementation(async ({ status }: { status: string }) => ({ data: byStatus[status] ?? [], has_more: false }));
  const paidLifetime = (intent: Record<string, unknown>) => ({ id: "cs_life_paid", mode: "payment", status: "complete", metadata: { purchase_type: "lifetime", user_id: "user_1" }, payment_intent: intent });

  it("expires an abandoned subscription Checkout before issuing a Lifetime one", async () => {
    sessionsByStatus({ open: [subscriptionCheckout] });

    const response = await (POST as unknown as () => Promise<Response>)();

    expect(response.status).toBe(200);
    expect(m.sessionsExpire).toHaveBeenCalledWith("cs_one_bank");
    expect(m.sessionsExpire.mock.invocationCallOrder[0]).toBeLessThan(m.sessionsCreate.mock.invocationCallOrder[0]);
  });

  it("fails closed when the other Checkout cannot be confirmed expired", async () => {
    sessionsByStatus({ open: [subscriptionCheckout] });
    m.sessionsExpire.mockResolvedValue({ id: "cs_one_bank", status: "complete" });

    const response = await (POST as unknown as () => Promise<Response>)();

    expect(response.status).toBe(503);
    expect(m.sessionsCreate).not.toHaveBeenCalled();
  });

  it("refuses a second Lifetime Checkout when the first is paid but not yet fulfilled", async () => {
    sessionsByStatus({ complete: [paidLifetime({ status: "succeeded", latest_charge: { refunded: false } })] });

    const response = await (POST as unknown as () => Promise<Response>)();

    expect(response.status).toBe(409);
    expect(m.sessionsCreate).not.toHaveBeenCalled();
    expect(m.sessionsList).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_1", status: "complete", expand: ["data.payment_intent.latest_charge"] }));
  });

  it("refuses while a completed Lifetime payment is still processing", async () => {
    sessionsByStatus({ complete: [paidLifetime({ status: "processing", latest_charge: null })] });

    expect((await (POST as unknown as () => Promise<Response>)()).status).toBe(409);
    expect(m.sessionsCreate).not.toHaveBeenCalled();
  });

  it("allows buying again after an earlier Lifetime payment was fully refunded", async () => {
    sessionsByStatus({ complete: [paidLifetime({ status: "succeeded", latest_charge: { refunded: true } })] });

    expect((await (POST as unknown as () => Promise<Response>)()).status).toBe(200);
    expect(m.sessionsCreate).toHaveBeenCalledOnce();
  });
});
