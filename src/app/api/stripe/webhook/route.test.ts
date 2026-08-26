import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const constructEvent = vi.fn();
const retrieveSubscription = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/stripe", () => ({
  createStripeClient: vi.fn(() => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: retrieveSubscription },
  })),
}));
vi.mock("@/lib/stripe-config", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/stripe-config")>();
  return { ...original, getStripeConfig: () => ({
    secretKey: "sk_test_example",
    webhookSecret: "whsec_example",
    monthlyPriceId: "price_monthly",
    annualPriceId: "price_annual",
    singleMonthlyPriceId: "price_single_monthly",
    singleAnnualPriceId: "price_single_annual",
    pairMonthlyPriceId: "price_pair_monthly",
    pairAnnualPriceId: "price_pair_annual",
    allMonthlyPriceId: "price_all_monthly",
    allAnnualPriceId: "price_all_annual",
  }) };
});
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc })),
}));

import { POST } from "@/app/api/stripe/webhook/route";

const userId = "150a3d0e-4c34-45cc-9748-68252f0fb8f1";
const subscriptionEvent = {
  id: "evt_1",
  created: 1_800_000_000,
  type: "customer.subscription.updated",
  data: {
    object: {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      metadata: { user_id: userId, product_id: "bundle_all" },
      items: { data: [{
        price: { id: "price_monthly" },
        current_period_start: 1_799_000_000,
        current_period_end: 1_801_000_000,
      }] },
    },
  },
};

function request(signature = "valid") {
  return new Request("https://pastpaperprep.com/api/stripe/webhook", {
    method: "POST",
    body: "raw-body",
    headers: { "stripe-signature": signature },
  });
}

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retrieveSubscription.mockResolvedValue(subscriptionEvent.data.object);
  });

  it("rejects invalid signatures without mutating entitlement state", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad signature"); });
    const response = await POST(request("invalid"));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("applies a verified subscription through the order-safe database RPC", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    rpc.mockResolvedValue({ data: "applied", error: null });

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(rpc).toHaveBeenCalledWith("apply_stripe_subscription_event", {
      p_event_id: "evt_1",
      p_event_created: 1_800_000_000,
      p_subscription_id: "sub_1",
      p_customer_id: "cus_1",
      p_user_id: userId,
      p_product_id: "bundle_all",
      p_status: "active",
      p_starts_at: new Date(1_799_000_000 * 1000).toISOString(),
      p_expires_at: new Date(1_801_000_000 * 1000).toISOString(),
    });
  });

  it("uses Stripe's current subscription instead of a stale webhook snapshot", async () => {
    const staleEvent = structuredClone(subscriptionEvent);
    staleEvent.data.object.status = "active";
    constructEvent.mockReturnValue(staleEvent);
    retrieveSubscription.mockResolvedValue({
      ...subscriptionEvent.data.object,
      status: "canceled",
    });
    rpc.mockResolvedValue({ data: "applied", error: null });

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "apply_stripe_subscription_event",
      expect.objectContaining({ p_status: "revoked", p_expires_at: null }),
    );
  });

  it("revokes stored access when current Stripe metadata is unsupported", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    retrieveSubscription.mockResolvedValue({
      ...subscriptionEvent.data.object,
      metadata: { user_id: userId, product_id: "unsupported_product" },
    });
    rpc.mockResolvedValue({ data: "revoked", error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("invalidate_stripe_subscription_event", {
      p_event_id: "evt_1",
      p_event_created: 1_800_000_000,
      p_subscription_id: "sub_1",
    });
  });

  it("does not grant access from checkout completion alone", async () => {
    constructEvent.mockReturnValue({ id: "evt_checkout", type: "checkout.session.completed", data: { object: {} } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a retryable error when synchronization fails", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    rpc.mockResolvedValue({ data: null, error: { message: "customer mismatch" } });
    const response = await POST(request());
    expect(response.status).toBe(500);
  });

  it("returns a retryable error when Stripe cannot refresh the subscription", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    retrieveSubscription.mockRejectedValue(new Error("temporary Stripe error"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });
});
