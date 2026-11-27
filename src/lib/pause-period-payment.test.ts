import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { subscriptionPauseRelevant, verifyCurrentPeriodPaid } from "./pause-period-payment";

const START = 1_799_000_000, END = 1_801_000_000;
const sub = (extra: Record<string, unknown> = {}) => ({ id: "sub_1", customer: "cus_1", latest_invoice: "in_1", pause_collection: { behavior: "void" }, metadata: {}, items: { data: [{ current_period_start: START, current_period_end: END }] }, ...extra }) as unknown as Stripe.Subscription;
const invoice = (extra: Record<string, unknown> = {}, line: Record<string, unknown> = {}) => ({ id: "in_1", customer: "cus_1", status: "paid", amount_due: 600, amount_paid: 600,
  parent: { type: "subscription_details", subscription_details: { subscription: "sub_1" } },
  lines: { has_more: false, data: [{ period: { start: START, end: END }, parent: { type: "subscription_item_details", subscription_item_details: { subscription: "sub_1" } }, ...line }] }, ...extra });
const stripe = (value: unknown) => ({ invoices: { retrieve: vi.fn().mockResolvedValue(value) } }) as unknown as Stripe;

describe("paused period payment", () => {
  it("accepts only a paid invoice of this subscription ending at this period's end", async () => {
    expect(await verifyCurrentPeriodPaid(stripe(invoice()), sub())).toBe(true);
    expect(await verifyCurrentPeriodPaid(stripe(invoice({ amount_due: 0, amount_paid: 0 })), sub())).toBe(true);
    for (const bad of [invoice({ status: "void" }), invoice({ status: "draft" }), invoice({ status: "open" }), invoice({ customer: "cus_2" }),
      invoice({ parent: { type: "subscription_details", subscription_details: { subscription: "sub_2" } } }), invoice({}, { period: { start: START - 100, end: END - 100 } }),
      invoice({ amount_paid: 100 }), invoice({ lines: { has_more: true, data: [] } })]) {
      expect(await verifyCurrentPeriodPaid(stripe(bad), sub())).toBe(false);
    }
    expect(await verifyCurrentPeriodPaid(stripe(invoice()), sub({ latest_invoice: null }))).toBe(false);
  });
  it("throws on a failed lookup so the webhook retries", async () => {
    const failing = { invoices: { retrieve: vi.fn().mockRejectedValue(new Error("timeout")) } } as unknown as Stripe;
    await expect(verifyCurrentPeriodPaid(failing, sub())).rejects.toThrow("timeout");
  });
  it("detects pause-touched periods", () => {
    expect(subscriptionPauseRelevant(sub())).toBe(true);
    expect(subscriptionPauseRelevant(sub({ pause_collection: null }))).toBe(false);
  });
});
