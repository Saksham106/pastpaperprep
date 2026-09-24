import { describe, expect, it } from "vitest";
import { commissionRecordForInvoice, adjustmentForRefund, adjustmentForDispute } from "@/lib/referral-commission";

const invoice = { id: "in_1", parent: { type: "subscription_details", subscription_details: { subscription: "sub_1" } }, billing_reason: "subscription_create", status: "paid", amount_paid: 1190, subtotal: 1500, total_excluding_tax: 990, total_taxes: [{ amount: 200 }], total_discount_amounts: [{ amount: 110 }], amount_paid_off_stripe: 0, currency: "usd", customer: "cus_1" };
const attribution = { userId: "user", partnerCode: "pietro", commissionBps: 3000 };

describe("referral commission ledger inputs", () => {
  it("uses the subscription parent and only actual Stripe-collected first payment, net of tax", () => {
    expect(commissionRecordForInvoice(invoice, attribution, 1190)).toMatchObject({ stripe_invoice_id: "in_1", stripe_subscription_id: "sub_1", gross_collected_cents: 1190, tax_cents: 200, commission_cents: 297 });
    expect(commissionRecordForInvoice({ ...invoice, amount_paid: 0 }, attribution, 0)).toBeNull();
    expect(commissionRecordForInvoice({ ...invoice, amount_paid_off_stripe: 1190 }, attribution, 0)).toBeNull();
    expect(commissionRecordForInvoice({ ...invoice, billing_reason: "subscription_cycle" }, attribution, 1190)).toBeNull();
  });

  it("keys adjustments on real refund IDs and prorates the commission rather than deducting gross refund dollars", () => {
    const commission = { id: 2, commission_cents: 297, gross_collected_cents: 1190 };
    expect(adjustmentForRefund({ id: "re_1", amount: 595, status: "succeeded" }, commission)).toEqual({ commission_id: 2, stripe_refund_id: "re_1", stripe_dispute_id: null, amount_cents: 148, reason: "refund" });
    expect(adjustmentForRefund({ id: "re_2", amount: 100, status: "pending" }, commission)).toBeNull();
    expect(adjustmentForRefund({ id: "re_3", amount: 1190, status: "succeeded" }, commission)?.amount_cents).toBe(297);
    expect(adjustmentForDispute({ id: "dp_1", status: "needs_response" }, commission)).toMatchObject({ stripe_dispute_id: "dp_1", amount_cents: 297, reason: "dispute" });
    expect(adjustmentForDispute({ id: "dp_1", status: "won" }, commission)).toMatchObject({ stripe_dispute_id: "dp_1", amount_cents: -297, reason: "dispute_won" });
    expect(adjustmentForDispute({ id: "dp_1", status: "lost" }, commission)).toMatchObject({ stripe_dispute_id: "dp_1", amount_cents: 0, reason: "dispute_lost" });
  });
});
