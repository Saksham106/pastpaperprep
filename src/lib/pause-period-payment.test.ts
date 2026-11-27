import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { invoiceFromPausedSubscription, subscriptionPauseRelevant, verifyCurrentPeriodPaid } from "./pause-period-payment";

const START = 1_799_000_000, END = 1_801_000_000;
const sub = (extra: Record<string, unknown> = {}) => ({ id: "sub_1", customer: "cus_1", latest_invoice: "in_newer", pause_collection: { behavior: "void" }, metadata: {},
  items: { data: [{ id: "si_1", quantity: 1, price: { id: "price_m" }, current_period_start: START, current_period_end: END }] }, ...extra }) as unknown as Stripe.Subscription;
const line = (extra: Record<string, unknown> = {}, details: Record<string, unknown> = {}) => ({ amount: 600, quantity: 1, period: { start: START, end: END },
  pricing: { type: "price_details", price_details: { price: "price_m" } },
  parent: { type: "subscription_item_details", subscription_item_details: { subscription: "sub_1", subscription_item: "si_1", proration: false, ...details } }, ...extra });
const invoice = (lines: unknown[], extra: Record<string, unknown> = {}) => ({ id: "in_1", customer: "cus_1", status: "paid", amount_due: 600, amount_paid: 600,
  parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: {} } }, lines: { has_more: false, data: lines }, ...extra });
const stripe = (invoices: unknown[], lineItems?: unknown) => ({ invoices: { list: vi.fn().mockResolvedValue({ data: invoices, has_more: false }), listLineItems: vi.fn().mockResolvedValue(lineItems) } }) as unknown as Stripe;

describe("paused period payment", () => {
  it("finds the period's payment even when a newer unrelated invoice exists", async () => {
    const unrelated = invoice([line({ period: { start: END - 100, end: END } }, { proration: true })], { id: "in_newer" });
    expect(await verifyCurrentPeriodPaid(stripe([unrelated, invoice([line()])]), sub())).toBe(true);
  });
  it("counts a fully discounted (zero-due) invoice", async () => {
    expect(await verifyCurrentPeriodPaid(stripe([invoice([line({ amount: 0 })], { amount_due: 0, amount_paid: 0 })]), sub())).toBe(true);
  });
  it.each([
    ["a prorated partial period", line({ period: { start: START + 500, end: END } }, { proration: true })],
    ["a line starting at another time", line({ period: { start: START + 500, end: END } })],
    ["another subscription item", line({}, { subscription_item: "si_2" })],
    ["another subscription", line({}, { subscription: "sub_2" })],
    ["another price", line({ pricing: { type: "price_details", price_details: { price: "price_other" } } })],
    ["another quantity", line({ quantity: 2 })],
    ["a credit line", line({ amount: -600 })],
  ])("never treats %s as paying for the period", async (_name, bad) => {
    expect(await verifyCurrentPeriodPaid(stripe([invoice([bad])]), sub())).toBe(false);
  });
  it("rejects underpaid, foreign and missing invoices", async () => {
    expect(await verifyCurrentPeriodPaid(stripe([invoice([line()], { amount_paid: 100 })]), sub())).toBe(false);
    expect(await verifyCurrentPeriodPaid(stripe([invoice([line()], { customer: "cus_2" })]), sub())).toBe(false);
    expect(await verifyCurrentPeriodPaid(stripe([]), sub())).toBe(false);
  });
  it("reads paginated invoice lines in full", async () => {
    const client = stripe([invoice([], { lines: { has_more: true, data: [] } })], { data: [line()], has_more: false });
    expect(await verifyCurrentPeriodPaid(client, sub())).toBe(true);
    expect(client.invoices.listLineItems).toHaveBeenCalledWith("in_1", { limit: 100 }, expect.any(Object));
  });
  it("throws on a failed lookup so the webhook retries", async () => {
    const failing = { invoices: { list: vi.fn().mockRejectedValue(new Error("timeout")) } } as unknown as Stripe;
    await expect(verifyCurrentPeriodPaid(failing, sub())).rejects.toThrow("timeout");
  });
  it("detects pause-touched periods and early-resume invoices", () => {
    expect(subscriptionPauseRelevant(sub())).toBe(true);
    expect(subscriptionPauseRelevant(sub({ pause_collection: null }))).toBe(false);
    expect(invoiceFromPausedSubscription(invoice([], { parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: { pause_access_until: "2026-12-26T00:00:00.000Z" } } } }) as unknown as Stripe.Invoice)).toBe(true);
    expect(invoiceFromPausedSubscription(invoice([]) as unknown as Stripe.Invoice)).toBe(false);
  });
});
