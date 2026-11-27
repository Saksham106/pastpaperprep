import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { chargeAndResumeFlexible, ResumePaymentDeclined, ResumeUnavailable, verifyResumeInvoice } from "./pause-resume-charge";

const NOW = Date.parse("2027-01-05T10:00:00Z");
const sub = (extra: Record<string, unknown> = {}) => ({ id: "sub_1", customer: "cus_1", default_payment_method: "pm_1", metadata: { user_id: "u1" },
  items: { data: [{ current_period_start: NOW / 1000, current_period_end: NOW / 1000 + 31 * 86400 }] }, ...extra }) as unknown as Stripe.Subscription;
function client(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const track = (name: string, value: unknown) => vi.fn(async () => { calls.push(name); return value; });
  const stripe = {
    invoices: { create: track("invoice", { id: "in_r" }), finalizeInvoice: track("finalize", {}), pay: track("pay", { status: "paid", amount_paid: 600 }), voidInvoice: track("void", {}), retrieve: vi.fn() },
    invoiceItems: { create: track("item", {}) },
    subscriptions: { update: track("update", {}), retrieve: vi.fn() },
    invoicePayments: { list: vi.fn(async () => ({ data: [{ status: "paid", payment: { type: "payment_intent", payment_intent: "pi_1" } }] })) },
    refunds: { create: vi.fn(async () => ({})) },
    ...overrides,
  };
  return { stripe: stripe as unknown as Stripe, raw: stripe, calls };
}
const input = { intentId: "i1", amountCents: 600, currency: "usd", nowMs: NOW };

describe("flexible early resume", () => {
  it("charges the full month on its own invoice first, then lifts the pause without another charge", async () => {
    const { stripe, raw, calls } = client();
    expect(await chargeAndResumeFlexible(stripe, sub(), input)).toEqual({ invoiceId: "in_r" });
    expect(calls).toEqual(["invoice", "item", "finalize", "pay", "update"]);
    expect(raw.invoices.create).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_1", default_payment_method: "pm_1", pending_invoice_items_behavior: "exclude", discounts: [], auto_advance: false,
      metadata: expect.objectContaining({ purpose: "pause_resume", subscription_id: "sub_1", expected_amount: "600" }) }), expect.objectContaining({ idempotencyKey: "pastpaperprep-resume-invoice-i1" }));
    expect(raw.invoiceItems.create).toHaveBeenCalledWith(expect.objectContaining({ invoice: "in_r", amount: 600, currency: "usd", discountable: false }), expect.anything());
    expect(raw.invoices.pay).toHaveBeenCalledWith("in_r", { payment_method: "pm_1", off_session: true }, expect.anything());
    expect(raw.subscriptions.update).toHaveBeenCalledWith("sub_1", { pause_collection: "", billing_cycle_anchor: "now", proration_behavior: "none",
      metadata: { pause_resumes_at: new Date(NOW - 60_000 + 86_400_000).toISOString(), pause_resume_invoice: "in_r" } }, expect.anything());
  });
  it("voids the invoice and changes nothing when the card is declined", async () => {
    const { stripe, raw, calls } = client();
    raw.invoices.pay = vi.fn(async () => { throw Object.assign(new Error("declined"), { type: "StripeCardError" }); });
    await expect(chargeAndResumeFlexible(stripe, sub(), input)).rejects.toBeInstanceOf(ResumePaymentDeclined);
    expect(calls).toContain("void");
    expect(raw.subscriptions.update).not.toHaveBeenCalled();
  });
  it("treats an incomplete payment as declined", async () => {
    const { stripe, raw } = client();
    raw.invoices.pay = vi.fn(async () => ({ status: "open", amount_paid: 0 }));
    await expect(chargeAndResumeFlexible(stripe, sub(), input)).rejects.toBeInstanceOf(ResumePaymentDeclined);
    expect(raw.invoices.voidInvoice).toHaveBeenCalled(); expect(raw.subscriptions.update).not.toHaveBeenCalled();
  });
  it("refuses before any write without a saved card or price", async () => {
    const { stripe, calls } = client();
    await expect(chargeAndResumeFlexible(stripe, sub({ default_payment_method: null }), input)).rejects.toBeInstanceOf(ResumeUnavailable);
    await expect(chargeAndResumeFlexible(stripe, sub(), { ...input, amountCents: 0 })).rejects.toBeInstanceOf(ResumeUnavailable);
    expect(calls).toEqual([]);
  });
  it("refunds when lifting the pause fails, but not when it actually went through", async () => {
    const failing = client();
    failing.raw.subscriptions.update = vi.fn(async () => { throw new Error("timeout"); });
    failing.raw.subscriptions.retrieve = vi.fn(async () => ({ pause_collection: { behavior: "void" }, metadata: {} }));
    await expect(chargeAndResumeFlexible(failing.stripe, sub(), input)).rejects.toThrow("timeout");
    expect(failing.raw.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ payment_intent: "pi_1" }), expect.anything());
    const applied = client();
    applied.raw.subscriptions.update = vi.fn(async () => { throw new Error("timeout"); });
    applied.raw.subscriptions.retrieve = vi.fn(async () => ({ pause_collection: null, metadata: { pause_resume_invoice: "in_r" } }));
    expect(await chargeAndResumeFlexible(applied.stripe, sub(), input)).toEqual({ invoiceId: "in_r" });
    expect(applied.raw.refunds.create).not.toHaveBeenCalled();
  });
});

describe("resume invoice proof", () => {
  const paidAt = NOW / 1000 - 5;
  const invoice = (extra: Record<string, unknown> = {}) => ({ id: "in_r", status: "paid", customer: "cus_1", amount_paid: 600, status_transitions: { paid_at: paidAt },
    metadata: { purpose: "pause_resume", subscription_id: "sub_1", expected_amount: "600" }, ...extra });
  const check = (inv: unknown, s = sub({ metadata: { pause_resume_invoice: "in_r" } })) => verifyResumeInvoice({ invoices: { retrieve: vi.fn(async () => inv) } } as unknown as Stripe, s);
  it("accepts the paid resume invoice for the period it started", async () => {
    expect(await check(invoice())).toBe(true);
  });
  it.each([
    ["unpaid", invoice({ status: "void" })],
    ["underpaid", invoice({ amount_paid: 100 })],
    ["another customer", invoice({ customer: "cus_2" })],
    ["another subscription", invoice({ metadata: { purpose: "pause_resume", subscription_id: "sub_2", expected_amount: "600" } })],
    ["not a resume invoice", invoice({ metadata: { subscription_id: "sub_1", expected_amount: "600" } })],
    ["paid long before the period", invoice({ status_transitions: { paid_at: NOW / 1000 - 3600 } })],
    ["paid after the period started", invoice({ status_transitions: { paid_at: NOW / 1000 + 600 } })],
  ])("rejects %s", async (_name, bad) => {
    expect(await check(bad)).toBe(false);
  });
  it("can't prove a later period", async () => {
    const later = sub({ metadata: { pause_resume_invoice: "in_r" }, items: { data: [{ current_period_start: NOW / 1000 + 31 * 86400, current_period_end: NOW / 1000 + 59 * 86400 }] } });
    expect(await check(invoice(), later)).toBe(false);
    expect(await check(invoice(), sub())).toBe(false);
  });
});
