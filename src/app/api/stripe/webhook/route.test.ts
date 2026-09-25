import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const constructEvent = vi.fn();
const retrieveSubscription = vi.fn();
const rpc = vi.fn();
const { processReferralInvoicePaid, processReferralChargeRefunded, processReferralDisputeChanged } = vi.hoisted(() => ({ processReferralInvoicePaid: vi.fn(), processReferralChargeRefunded: vi.fn(), processReferralDisputeChanged: vi.fn() }));
vi.mock("@/lib/referral-events", () => ({ processReferralInvoicePaid, processReferralChargeRefunded, processReferralDisputeChanged }));

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
    customMonthlyPriceId: "price_custom_monthly",
    customAnnualPriceId: "price_custom_annual",
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
        price: { id: "price_monthly", recurring: { interval: "month" } },
        quantity: 1,
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
    rpc.mockImplementation(async (name: string) => ({ data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease", error: null }));
  });

  it("rejects invalid signatures without mutating entitlement state", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad signature"); });
    const response = await POST(request("invalid"));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("applies a verified subscription through the order-safe database RPC", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    rpc.mockImplementation(async (name: string) => ({ data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease" ? true : "applied", error: null }));

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(retrieveSubscription).toHaveBeenCalledWith("sub_1", {}, { timeout: 60_000 });
    expect(rpc).toHaveBeenNthCalledWith(1, "acquire_stripe_subscription_sync_lease", expect.objectContaining({ p_subscription_id: "sub_1" }));
    expect(rpc).toHaveBeenCalledWith("apply_stripe_subscription_event", expect.objectContaining({ p_lease_token: expect.any(String) }));
    expect(rpc).toHaveBeenCalledWith("release_stripe_subscription_sync_lease", { p_subscription_id: "sub_1", p_lease_token: expect.any(String) });

  });

  it("persists custom selected banks, quantity, and verified price through the RPC", async () => {
    const customEvent = structuredClone(subscriptionEvent) as unknown as {
      data: { object: { metadata: Record<string, string>; items: { data: Array<{ price: { id: string; recurring?: { interval: string } }; quantity?: number }> } } };
    };
    customEvent.data.object.metadata = {
      user_id: userId,
      product_id: "bundle_custom",
      selected_bank_ids: JSON.stringify(["ib-hl", "ib-sl"]),
      billing_interval: "annual",
      price_id: "price_custom_annual",
    };
    customEvent.data.object.items.data[0].price.id = "price_custom_annual";
    customEvent.data.object.items.data[0].price.recurring = { interval: "year" };
    customEvent.data.object.items.data[0].quantity = 2;
    constructEvent.mockReturnValue(customEvent);
    retrieveSubscription.mockResolvedValue(customEvent.data.object);
    rpc.mockImplementation(async (name: string) => ({ data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease" ? true : "applied", error: null }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_stripe_subscription_event", expect.objectContaining({
      p_product_id: "bundle_custom",
      p_selected_bank_ids: ["ib-hl", "ib-sl"],
      p_quantity: 2,
      p_price_id: "price_custom_annual",
      p_interval: "annual",
    }));
  });

  it("uses Stripe's current subscription instead of a stale webhook snapshot", async () => {
    const staleEvent = structuredClone(subscriptionEvent);
    staleEvent.data.object.status = "active";
    constructEvent.mockReturnValue(staleEvent);
    retrieveSubscription.mockResolvedValue({
      ...subscriptionEvent.data.object,
      status: "canceled",
    });
    rpc.mockImplementation(async (name: string) => ({ data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease" ? true : "applied", error: null }));

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
    rpc.mockImplementation(async (name: string) => ({ data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease" ? true : "revoked", error: null }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("invalidate_stripe_subscription_event", {
      p_event_id: "evt_1",
      p_event_created: 1_800_000_000,
      p_subscription_id: "sub_1",
      p_lease_token: expect.any(String),
    });
  });

  it("does not grant access from checkout completion alone", async () => {
    constructEvent.mockReturnValue({ id: "evt_checkout", type: "checkout.session.completed", data: { object: {} } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records a signed first paid invoice without confusing it with entitlement sync", async () => {
    const event = { id: "evt_invoice", type: "invoice.paid", data: { object: { id: "in_first", billing_reason: "subscription_create" } } };
    constructEvent.mockReturnValue(event);
    processReferralInvoicePaid.mockResolvedValue(undefined);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(processReferralInvoicePaid).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reconciles charge refunds through the signed Stripe event", async () => {
    constructEvent.mockReturnValue({ id: "evt_refund", type: "charge.refunded", data: { object: { id: "ch_first" } } });
    processReferralChargeRefunded.mockResolvedValue(undefined);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(processReferralChargeRefunded).toHaveBeenCalledTimes(1);
  });

  it("reconciles an asynchronously succeeded refund from refund.updated", async () => {
    constructEvent.mockReturnValue({ id: "evt_refund_update", type: "refund.updated", data: { object: { id: "re_first", charge: "ch_first", status: "succeeded" } } });
    processReferralChargeRefunded.mockResolvedValue(undefined);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(processReferralChargeRefunded).toHaveBeenCalledTimes(1);
  });

  it("reconciles a dispute update against current Stripe state", async () => {
    constructEvent.mockReturnValue({ id: "evt_dispute", type: "charge.dispute.closed", data: { object: { id: "dp_first" } } });
    processReferralDisputeChanged.mockResolvedValue(undefined);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(processReferralDisputeChanged).toHaveBeenCalledTimes(1);
  });

  it("asks Stripe to retry a failed commission write", async () => {
    constructEvent.mockReturnValue({ id: "evt_invoice", type: "invoice.paid", data: { object: { id: "in_first" } } });
    processReferralInvoicePaid.mockRejectedValue(new Error("DB unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(500);
  });

  it("returns a retryable error when synchronization fails", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    rpc.mockResolvedValue({ data: null, error: { message: "customer mismatch" } });
    const response = await POST(request());
    expect(response.status).toBe(500);
  });

  it("does not retrieve or mutate when the subscription lease is busy", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    rpc.mockImplementation(async (name: string) => ({ data: name === "acquire_stripe_subscription_sync_lease" ? false : true, error: null }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(retrieveSubscription).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns a retryable error when lease acquisition fails", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    rpc.mockResolvedValue({ data: null, error: { message: "lease rpc unavailable" } });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(retrieveSubscription).not.toHaveBeenCalled();
  });

  it("returns a retryable error when lease release fails", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    rpc.mockImplementation(async (name: string) => ({ data: name !== "release_stripe_subscription_sync_lease", error: null }));
    const response = await POST(request());
    expect(response.status).toBe(500);
  });

  it("returns a retryable error when Stripe cannot refresh the subscription", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    retrieveSubscription.mockRejectedValue(new Error("temporary Stripe error"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(rpc).not.toHaveBeenCalledWith("apply_stripe_subscription_event", expect.anything());
  });
});
