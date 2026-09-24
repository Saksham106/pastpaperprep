import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { processReferralInvoicePaid, processReferralChargeRefunded, processReferralDisputeChanged } from "./referral-events";

const invoice = {
  id: "in_first", status: "paid", billing_reason: "subscription_create", amount_paid: 1000,
  amount_paid_off_stripe: 0, subtotal: 1000, total_excluding_tax: 1000, total_taxes: [], total_discount_amounts: [],
  currency: "usd", customer: "cus_student", status_transitions: { paid_at: 1789934400 },
  parent: { type: "subscription_details", subscription_details: { subscription: "sub_first" } },
};
function db(data: Record<string, unknown>) {
  const rpc = vi.fn().mockResolvedValue({ data: "recorded", error: null });
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: data[table] ?? null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    return query;
  });
  return { rpc, from };
}
function stripe() {
  return {
    invoices: { retrieve: vi.fn().mockResolvedValue(invoice) },
    subscriptions: { retrieve: vi.fn().mockResolvedValue({ id: "sub_first", customer: "cus_student", metadata: { user_id: "user-new", referral_code: "pietro" } }) },
    invoicePayments: { list: vi.fn().mockResolvedValue({ data: [{ id: "inpay_first", status: "paid", amount_paid: 1000, payment: { type: "payment_intent", payment_intent: "pi_first" } }], has_more: false }) },
    paymentIntents: { retrieve: vi.fn().mockResolvedValue({ status: "succeeded", amount_received: 1000, currency: "usd", latest_charge: "ch_first" }) },
    refunds: { list: vi.fn().mockResolvedValue({ data: [], has_more: false }) },
    disputes: { list: vi.fn().mockResolvedValue({ data: [], has_more: false }) },
  };
}

describe("referral dispute reconciliation", () => {
  it("records a final dispute loss separately while retaining its held commission", async () => {
    const client = stripe();
    Object.assign(client, {
      charges: { retrieve: vi.fn().mockResolvedValue({ id: "ch_first", payment_intent: "pi_first" }) },
      disputes: { retrieve: vi.fn().mockResolvedValue({ id: "dp_first", charge: "ch_first" }), list: vi.fn().mockResolvedValue({ data: [{ id: "dp_first", status: "lost" }], has_more: false }) },
    });
    client.invoicePayments.list.mockResolvedValue({ data: [{ invoice: "in_first", status: "paid", payment: { type: "payment_intent", payment_intent: "pi_first" } }], has_more: false });
    const admin = db({ referral_commissions: { id: 1, commission_cents: 300, gross_collected_cents: 1000 } });
    await processReferralDisputeChanged(client as never, admin as never, { id: "dp_first" } as never);
    const calls = admin.from.mock.results.flatMap((item) => item.value.upsert.mock.calls);
    expect(calls.map((call) => call[0].reason)).toEqual(["dispute", "dispute_lost"]);
  });

  it("holds a commission on a dispute and releases it when Stripe says won", async () => {
    const client = stripe();
    Object.assign(client, {
      charges: { retrieve: vi.fn().mockResolvedValue({ id: "ch_first", payment_intent: "pi_first" }) },
      disputes: { retrieve: vi.fn().mockResolvedValue({ id: "dp_first", charge: "ch_first" }), list: vi.fn().mockResolvedValueOnce({ data: [{ id: "dp_first", status: "under_review" }], has_more: false }).mockResolvedValueOnce({ data: [{ id: "dp_first", status: "won" }], has_more: false }) },
    });
    client.invoicePayments.list.mockResolvedValue({ data: [{ invoice: "in_first", status: "paid", payment: { type: "payment_intent", payment_intent: "pi_first" } }], has_more: false });
    const admin = db({ referral_commissions: { id: "commission_1", commission_cents: 300, gross_collected_cents: 1000 } });
    await processReferralDisputeChanged(client as never, admin as never, { id: "dp_first" } as never);
    await processReferralDisputeChanged(client as never, admin as never, { id: "dp_first" } as never);
    const calls = admin.from.mock.results.flatMap((item) => item.value.upsert.mock.calls);
    expect(calls[0][0]).toMatchObject({ stripe_dispute_id: "dp_first", amount_cents: 300, reason: "dispute" });
    expect(calls[1][0]).toMatchObject({ stripe_dispute_id: "dp_first", amount_cents: 300, reason: "dispute" });
    expect(calls[2][0]).toMatchObject({ stripe_dispute_id: "dp_first", amount_cents: -300, reason: "dispute_won" });
  });
});

describe("referral refund reconciliation", () => {
  it("retries rather than selecting an arbitrary invoice when a charge maps to multiple paid invoice payments", async () => {
    const client = stripe();
    Object.assign(client, { charges: { retrieve: vi.fn().mockResolvedValue({ id: "ch_first", payment_intent: "pi_first" }) } });
    client.invoicePayments.list.mockResolvedValue({ data: [
      { invoice: "in_first", status: "paid", payment: { type: "payment_intent", payment_intent: "pi_first" } },
      { invoice: "in_second", status: "paid", payment: { type: "payment_intent", payment_intent: "pi_first" } },
    ], has_more: false });
    const admin = db({ referral_commissions: { id: 1, commission_cents: 300, gross_collected_cents: 1000 } });
    await expect(processReferralChargeRefunded(client as never, admin as never, { id: "ch_first" } as never)).rejects.toThrow("Ambiguous invoice payment");
  });

  it("maps the succeeded charge refund back to its paid invoice and creates one idempotent adjustment", async () => {
    const client = stripe();
    Object.assign(client, { charges: { retrieve: vi.fn().mockResolvedValue({ id: "ch_first", payment_intent: "pi_first" }) } });
    client.invoicePayments.list.mockResolvedValue({ data: [{ invoice: "in_first", status: "paid", payment: { type: "payment_intent", payment_intent: "pi_first" } }], has_more: false });
    client.refunds.list.mockResolvedValue({ data: [{ id: "re_partial", amount: 500, status: "succeeded" }], has_more: false });
    const admin = db({ referral_commissions: { id: "commission_1", commission_cents: 300, gross_collected_cents: 1000 } });
    await processReferralChargeRefunded(client as never, admin as never, { id: "ch_first" } as never);
    const adjustmentQuery = admin.from.mock.results.find((item) => item.value && item.value.upsert.mock.calls.length > 0);
    expect(adjustmentQuery?.value.upsert).toHaveBeenCalledWith(expect.objectContaining({ stripe_refund_id: "re_partial", amount_cents: 150 }), { onConflict: "stripe_refund_id", ignoreDuplicates: true });
  });
});

describe("first paid referral invoice", () => {
  it("records a verified Stripe-collected invoice using account attribution, never event metadata alone", async () => {
    const client = stripe();
    const admin = db({ referral_attributions: { partner_code: "pietro", attributed_at: "2026-09-01T00:00:00Z" }, referral_partners: { commission_bps: 3000 } });
    await processReferralInvoicePaid(client as never, admin as never, invoice as never);
    expect(admin.rpc).toHaveBeenCalledWith("record_first_referral_commission", expect.objectContaining({ p_user_id: "user-new", p_invoice_id: "in_first", p_gross_cents: 1000, p_commission_cents: 300 }));
  });

  it("rejects a nominally paid invoice if the PaymentIntent collected less cash than credited to the invoice", async () => {
    const client = stripe();
    client.paymentIntents.retrieve.mockResolvedValue({ status: "succeeded", amount_received: 100, currency: "usd", latest_charge: "ch_first" });
    const admin = db({ referral_attributions: { partner_code: "pietro", attributed_at: "2026-09-01T00:00:00Z" }, referral_partners: { commission_bps: 3000 } });
    await processReferralInvoicePaid(client as never, admin as never, invoice as never);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("flags a multi-payment invoice for manual reconciliation instead of silently dropping an earned commission", async () => {
    const client = stripe();
    client.invoicePayments.list.mockResolvedValue({ data: [
      { id: "inpay_a", status: "paid", amount_paid: 500, payment: { type: "payment_intent", payment_intent: "pi_a" } },
      { id: "inpay_b", status: "paid", amount_paid: 500, payment: { type: "payment_intent", payment_intent: "pi_b" } },
    ], has_more: false });
    const admin = db({ referral_attributions: { partner_code: "pietro" }, referral_partners: { commission_bps: 3000 } });
    await expect(processReferralInvoicePaid(client as never, admin as never, invoice as never)).rejects.toThrow("Multiple collected payments");
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("does not record a commission for invoice paid without a card payment", async () => {
    const client = stripe();
    client.invoicePayments.list.mockResolvedValue({ data: [], has_more: false });
    const admin = db({ referral_attributions: { partner_code: "pietro", attributed_at: "2026-09-01T00:00:00Z" }, referral_partners: { commission_bps: 3000 } });
    await processReferralInvoicePaid(client as never, admin as never, invoice as never);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("fails so Stripe retries if the atomic ledger write fails", async () => {
    const client = stripe();
    const admin = db({ referral_attributions: { partner_code: "pietro", attributed_at: "2026-09-01T00:00:00Z" }, referral_partners: { commission_bps: 3000 } });
    admin.rpc.mockResolvedValue({ data: null, error: new Error("DB unavailable") });
    await expect(processReferralInvoicePaid(client as never, admin as never, invoice as never)).rejects.toThrow("DB unavailable");
  });
});
