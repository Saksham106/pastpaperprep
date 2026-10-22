import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  access: vi.fn(),
  subscriptionsList: vi.fn(),
  sessionsList: vi.fn(),
  sessionsCreate: vi.fn(),
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
  checkout: { sessions: { list: m.sessionsList, create: m.sessionsCreate } },
}) }));

import { POST } from "@/app/api/billing/lifetime/checkout/route";

const post = () => (POST as unknown as () => Promise<Response>)();

function rpcGrants({ reserve = true, confirm = true } = {}) {
  m.rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: "cus_1", error: null }
    : name === "reserve_billing_checkout" ? { data: reserve, error: null }
      : name === "confirm_billing_checkout" ? { data: confirm, error: null }
        : name === "release_billing_checkout" ? { data: true, error: null }
          : { data: null, error: Error(name) });
}

describe("POST /api/billing/lifetime/checkout error codes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.access.mockResolvedValue({ rows: [], error: null });
    rpcGrants();
    m.subscriptionsList.mockResolvedValue({ data: [], has_more: false });
    m.sessionsList.mockResolvedValue({ data: [], has_more: false });
    m.sessionsCreate.mockResolvedValue({ id: "cs_life", url: "https://checkout.stripe.com/c/pay/cs_life" });
  });

  it.each(["past_due", "unpaid", "incomplete"])("sends a %s subscriber to fix payment instead of support", async (status) => {
    m.subscriptionsList.mockResolvedValue({ data: [{ id: "sub_1", status }], has_more: false });

    const response = await post();

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "PAYMENT_ISSUE" });
    expect(m.sessionsCreate).not.toHaveBeenCalled();
  });

  it("keeps other billed subscriptions on the support path", async () => {
    m.subscriptionsList.mockResolvedValue({ data: [{ id: "sub_1", status: "paused" }], has_more: false });

    const response = await post();

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "BILLING_SUPPORT" });
  });

  it("codes a checkout in progress and changed access", async () => {
    rpcGrants({ reserve: false });
    expect(await (await post()).json()).toMatchObject({ code: "CHECKOUT_IN_PROGRESS" });

    rpcGrants({ confirm: false });
    expect(await (await post()).json()).toMatchObject({ code: "ACCESS_CHANGED" });
  });

  it("codes unexpected failures", async () => {
    m.sessionsCreate.mockRejectedValue(Error("timeout"));

    const response = await post();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Lifetime checkout is temporarily unavailable", code: "CHECKOUT_UNAVAILABLE" });
  });

  it("returns a cancelled Lifetime checkout to the Lifetime offer", async () => {
    expect((await post()).status).toBe(200);
    expect(m.sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ cancel_url: "https://example.test/pricing?plan=lifetime&checkout=cancelled" }), expect.anything());
  });
});
