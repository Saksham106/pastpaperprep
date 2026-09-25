import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const constructEvent = vi.fn();
const retrieveSubscription = vi.fn();
const retrieveSchedule = vi.fn();
const releaseSchedule = vi.fn();
const retrieveInvoice = vi.fn();
const listInvoicePayments = vi.fn();
const rpc = vi.fn();
const { processReferralInvoicePaid, processReferralChargeRefunded, processReferralDisputeChanged } = vi.hoisted(() => ({ processReferralInvoicePaid: vi.fn(), processReferralChargeRefunded: vi.fn(), processReferralDisputeChanged: vi.fn() }));
vi.mock("@/lib/referral-events", () => ({ processReferralInvoicePaid, processReferralChargeRefunded, processReferralDisputeChanged }));

vi.mock("@/lib/stripe", () => ({
  createStripeClient: vi.fn(() => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: retrieveSubscription },
    subscriptionSchedules: { retrieve: retrieveSchedule, release: releaseSchedule },
    invoices: { retrieve: retrieveInvoice },
    invoicePayments: { list: listInvoicePayments },
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

function scheduledRenewal(status: "draft" | "paid" = "draft") {
  const sub = { ...structuredClone(subscriptionEvent.data.object), schedule: "sub_sched_1", latest_invoice: "in_renew" };
  const schedule = {
    id: "sub_sched_1", status: "active", subscription: "sub_1", customer: "cus_1",
    metadata: { owner: "pastpaperprep", user_id: userId, subscription_id: "sub_1", ownership_id: "account_qa_1" },
    current_phase: { start_date: 1_799_000_000, end_date: 1_801_000_000 },
    phases: [
      { start_date: 1_797_000_000, end_date: 1_799_000_000, metadata: { user_id: userId, product_id: "bundle_all" }, items: [{ price: "price_annual", quantity: 1 }] },
      { start_date: 1_799_000_000, end_date: 1_801_000_000, metadata: { user_id: userId, product_id: "bundle_all" }, items: [{ price: "price_monthly", quantity: 1 }] },
    ],
  };
  const invoice = { id: "in_renew", status, customer: "cus_1", billing_reason: "subscription_cycle", collection_method: "charge_automatically", amount_due: 2500, amount_paid: status === "paid" ? 2500 : 0,
    parent: { type: "subscription_details", subscription_details: { subscription: "sub_1" } },
    lines: { has_more: false, data: [{ period: { start: 1_799_000_000, end: 1_801_000_000 }, parent: { type: "subscription_item_details", subscription_item_details: { subscription: "sub_1", proration: false } } }] },
  };
  retrieveSubscription.mockImplementation(async () => releaseSchedule.mock.calls.length ? { ...sub, schedule: null } : sub);
  retrieveSchedule.mockImplementation(async () => releaseSchedule.mock.calls.length ? { ...schedule, status: "released", subscription: null, current_phase: null } : schedule);
  releaseSchedule.mockResolvedValue({ ...schedule, status: "released", subscription: null, current_phase: null });
  retrieveInvoice.mockResolvedValue(invoice);
  listInvoicePayments.mockResolvedValue({ has_more: false, data: status === "paid" ? [{ invoice: "in_renew", status: "paid", amount_paid: 2500, payment: { type: "payment_intent", payment_intent: "pi_paid" } }] : [] });
  return { sub, schedule, invoice };
}
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
    processReferralInvoicePaid.mockReset().mockResolvedValue(undefined);
    processReferralChargeRefunded.mockReset().mockResolvedValue(undefined);
    processReferralDisputeChanged.mockReset().mockResolvedValue(undefined);
    retrieveSubscription.mockResolvedValue(subscriptionEvent.data.object);
    rpc.mockImplementation(async (name: string, args?: { p_price_id?: string }) => ({ data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease" ? true : name === "get_checkout_price_catalog" ? [{ price_id: args?.p_price_id, product_id: args?.p_price_id?.includes("custom") ? "bundle_custom" : "bundle_all", billing_interval: args?.p_price_id?.includes("annual") ? "annual" : "monthly", active: true, grandfathered: false }] : "applied", error: null }));
  });

  it("rejects invalid signatures without mutating entitlement state", async () => {
    constructEvent.mockImplementation(() => { throw new Error("bad signature"); });
    const response = await POST(request("invalid"));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("looks up the actual price in the service catalog before applying", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    rpc.mockImplementation(async (name: string, args?: { p_price_id?: string }) => ({ data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease" ? true : name === "get_checkout_price_catalog" ? [{ price_id: args?.p_price_id, product_id: "bundle_all", billing_interval: "monthly", active: false, grandfathered: true }, { price_id: args?.p_price_id, product_id: "bank_ib_hl", billing_interval: "monthly", active: true, grandfathered: false }] : "applied", error: null }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("get_checkout_price_catalog", { p_price_id: "price_monthly" });
  });

  it("invalidates under the lease when the catalog tuple does not match", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    rpc.mockImplementation(async (name: string, args?: { p_price_id?: string }) => ({
      data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease" ? true
        : name === "get_checkout_price_catalog" ? [{ price_id: args?.p_price_id, product_id: "bundle_custom", billing_interval: "monthly", active: false, grandfathered: true }]
          : "revoked",
      error: null,
    }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("invalidate_stripe_subscription_event", expect.objectContaining({ p_lease_token: expect.any(String) }));
    expect(rpc).not.toHaveBeenCalledWith("apply_stripe_subscription_event", expect.anything());
  });

  it("applies a verified subscription through the order-safe database RPC", async () => {
    constructEvent.mockReturnValue(subscriptionEvent);
    rpc.mockImplementation(async (name: string, args?: { p_price_id?: string }) => ({ data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease" ? true : name === "get_checkout_price_catalog" ? [{ price_id: args?.p_price_id, product_id: args?.p_price_id?.includes("custom") ? "bundle_custom" : "bundle_all", billing_interval: args?.p_price_id?.includes("annual") ? "annual" : "monthly", active: true, grandfathered: false }] : "applied", error: null }));

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
    rpc.mockImplementation(async (name: string, args?: { p_price_id?: string }) => ({ data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease" ? true : name === "get_checkout_price_catalog" ? [{ price_id: args?.p_price_id, product_id: args?.p_price_id?.includes("custom") ? "bundle_custom" : "bundle_all", billing_interval: args?.p_price_id?.includes("annual") ? "annual" : "monthly", active: true, grandfathered: false }] : "applied", error: null }));

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
    rpc.mockImplementation(async (name: string, args?: { p_price_id?: string }) => ({ data: name === "acquire_stripe_subscription_sync_lease" || name === "release_stripe_subscription_sync_lease" ? true : name === "get_checkout_price_catalog" ? [{ price_id: args?.p_price_id, product_id: args?.p_price_id?.includes("custom") ? "bundle_custom" : "bundle_all", billing_interval: args?.p_price_id?.includes("annual") ? "annual" : "monthly", active: true, grandfathered: false }] : "applied", error: null }));

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

  it("rejects a paid-looking scheduled renewal without a collected Stripe payment", async () => {
    scheduledRenewal("paid");
    listInvoicePayments.mockResolvedValue({ data: [], has_more: false });
    constructEvent.mockReturnValue(subscriptionEvent);
    expect((await POST(request())).status).toBe(503);
    expect(rpc).not.toHaveBeenCalledWith("apply_stripe_subscription_event", expect.anything());
  });

  it("rejects a schedule whose app ownership does not match the subscription", async () => {
    const { schedule } = scheduledRenewal("paid");
    retrieveSchedule.mockResolvedValue({ ...schedule, metadata: { ...schedule.metadata, user_id: "wrong-user" } });
    constructEvent.mockReturnValue(subscriptionEvent);
    expect((await POST(request())).status).toBe(503);
    expect(rpc).not.toHaveBeenCalledWith("apply_stripe_subscription_event", expect.anything());
  });

  it("rejects a paid invoice for the wrong subscription period", async () => {
    const { invoice } = scheduledRenewal("paid");
    retrieveInvoice.mockResolvedValue({ ...invoice, lines: { has_more: false, data: [{ ...invoice.lines.data[0], period: { start: 1_797_000_000, end: 1_799_000_000 } }] } });
    constructEvent.mockReturnValue(subscriptionEvent);
    expect((await POST(request())).status).toBe(503);
    expect(rpc).not.toHaveBeenCalledWith("apply_stripe_subscription_event", expect.anything());
  });

  it("ignores an older paid invoice rather than using a later paid renewal as proof", async () => {
    const { invoice } = scheduledRenewal("paid");
    constructEvent.mockReturnValue({ id: "evt_old_paid", created: 1_798_000_000, type: "invoice.paid", data: { object: { ...invoice, id: "in_old" } } });
    expect((await POST(request())).status).toBe(200);
    expect(rpc).not.toHaveBeenCalledWith("apply_stripe_subscription_event", expect.anything());
  });

  it("reconciles the app-owned renewal from its exact paid invoice event", async () => {
    const { invoice } = scheduledRenewal("paid");
    constructEvent.mockReturnValue({ id: "evt_renew_paid", created: 1_800_000_001, type: "invoice.paid", data: { object: invoice } });
    const response = await POST(request());
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(processReferralInvoicePaid).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("apply_stripe_subscription_event", expect.objectContaining({ p_event_id: "evt_renew_paid", p_subscription_id: "sub_1", p_product_id: "bundle_all" }));
  });

  it("detaches a paid second phase after syncing access so customers can cancel or edit again", async () => {
    const { sub, schedule, invoice } = scheduledRenewal("paid");
    constructEvent.mockReturnValue({ id: "evt_renew_paid", created: 1_800_000_001, type: "invoice.paid", data: { object: invoice } });
    releaseSchedule.mockResolvedValue({ ...schedule, status: "released", subscription: null, current_phase: null });
    retrieveSchedule.mockImplementation(async () => releaseSchedule.mock.calls.length ? { ...schedule, status: "released", subscription: null, current_phase: null } : schedule);
    retrieveSubscription.mockImplementation(async () => releaseSchedule.mock.calls.length ? { ...sub, schedule: null } : sub);
    expect((await POST(request())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_stripe_subscription_event", expect.objectContaining({ p_event_id: "evt_renew_paid" }));
    expect(releaseSchedule).toHaveBeenCalledWith("sub_sched_1", {}, expect.objectContaining({ idempotencyKey: expect.any(String) }));
  });

  it("retries schedule release if Stripe leaves the paid second phase attached", async () => {
    const { invoice } = scheduledRenewal("paid");
    constructEvent.mockReturnValue({ id: "evt_renew_paid", created: 1_800_000_001, type: "invoice.paid", data: { object: invoice } });
    releaseSchedule.mockRejectedValue(new Error("temporary Stripe error"));
    expect((await POST(request())).status).toBe(503);
    expect(rpc).toHaveBeenCalledWith("apply_stripe_subscription_event", expect.anything());
  });

  it("does not grant a scheduled target while its renewal invoice is draft", async () => {
    scheduledRenewal("draft");
    constructEvent.mockReturnValue(subscriptionEvent);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(retrieveSchedule).toHaveBeenCalledWith("sub_sched_1", {}, { timeout: 60_000 });
    expect(rpc).not.toHaveBeenCalledWith("apply_stripe_subscription_event", expect.anything());
  });
});
