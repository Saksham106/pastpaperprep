import { describe, expect, it } from "vitest";
import { findPaymentFailedNotice, hasLapsedSubscription, trustedHostedInvoiceUrl, type SubscriptionLike } from "@/lib/payment-failed-notice";

const USER = "11111111-1111-4111-8111-111111111111";
const DAY = 86_400;
const START = 1_800_000_000;
const ctx = { customerId: "cus_A", userId: USER, nowSeconds: START + 3 * DAY };

function sub(overrides: Partial<SubscriptionLike> = {}, invoice: Record<string, unknown> = {}): SubscriptionLike {
  return {
    id: "sub_1",
    status: "past_due",
    customer: "cus_A",
    metadata: { user_id: USER },
    items: { data: [{ current_period_start: START, current_period_end: START + 30 * DAY }] },
    latest_invoice: {
      id: "in_1", status: "open", customer: "cus_A", amount_remaining: 1000, currency: "usd", attempt_count: 1,
      next_payment_attempt: START + 5 * DAY, hosted_invoice_url: "https://invoice.stripe.com/i/acct_1/test_abc",
      ...invoice,
    },
    ...overrides,
  };
}

describe("findPaymentFailedNotice", () => {
  it("describes a past-due renewal inside the grace window", () => {
    expect(findPaymentFailedNotice([sub()], ctx)).toEqual({
      invoiceId: "in_1",
      amountCents: 1000,
      currency: "usd",
      accessEndsAt: new Date((START + 14 * DAY) * 1000).toISOString(),
      accessEnded: false,
      nextRetryAt: new Date((START + 5 * DAY) * 1000).toISOString(),
      payUrl: "https://invoice.stripe.com/i/acct_1/test_abc",
    });
  });

  it("caps the grace at the period end, like the webhook", () => {
    const short = sub({ items: { data: [{ current_period_start: START, current_period_end: START + 10 * DAY }] } });
    expect(findPaymentFailedNotice([short], ctx)?.accessEndsAt).toBe(new Date((START + 10 * DAY) * 1000).toISOString());
  });

  it("marks access as ended once the grace has passed or Stripe stopped retrying", () => {
    const late = findPaymentFailedNotice([sub()], { ...ctx, nowSeconds: START + 15 * DAY });
    expect(late).toMatchObject({ accessEnded: true, accessEndsAt: null, nextRetryAt: null });
    expect(findPaymentFailedNotice([sub({ status: "unpaid" }, { next_payment_attempt: null })], ctx)).toMatchObject({ accessEnded: true, accessEndsAt: null });
  });

  it("gives no date while a pause or a scheduled plan change can change what the webhook grants", () => {
    expect(findPaymentFailedNotice([sub({ pause_collection: { behavior: "void" } })], ctx)).toMatchObject({ accessEndsAt: null, accessEnded: false });
    expect(findPaymentFailedNotice([sub({ schedule: "sub_sched_1" })], ctx)).toMatchObject({ accessEndsAt: null, accessEnded: false });
    // Past the grace with a schedule: no date and no claim that access ended (the webhook may differ).
    expect(findPaymentFailedNotice([sub({ schedule: "sub_sched_1" })], { ...ctx, nowSeconds: START + 20 * DAY })).toMatchObject({ accessEndsAt: null, accessEnded: false });
  });

  it("shows nothing for healthy, cancelled or unattempted bills", () => {
    expect(findPaymentFailedNotice([sub({ status: "active" })], ctx)).toBeNull();
    expect(findPaymentFailedNotice([sub({ status: "canceled" })], ctx)).toBeNull();
    expect(findPaymentFailedNotice([sub({}, { status: "paid" })], ctx)).toBeNull();
    expect(findPaymentFailedNotice([sub({}, { status: "void" })], ctx)).toBeNull();
    expect(findPaymentFailedNotice([sub({}, { attempt_count: 0 })], ctx)).toBeNull();
    expect(findPaymentFailedNotice([sub({}, { amount_remaining: 0 })], ctx)).toBeNull();
    expect(findPaymentFailedNotice([sub({ latest_invoice: "in_1" })], ctx)).toBeNull();
    expect(findPaymentFailedNotice([sub({ latest_invoice: null })], ctx)).toBeNull();
  });

  it("ignores subscriptions or invoices that belong to someone else", () => {
    expect(findPaymentFailedNotice([sub({ metadata: { user_id: "22222222-2222-4222-8222-222222222222" } })], ctx)).toBeNull();
    expect(findPaymentFailedNotice([sub({ customer: "cus_B" })], ctx)).toBeNull();
    expect(findPaymentFailedNotice([sub({}, { customer: "cus_B" })], ctx)).toBeNull();
    // Older subscriptions without user_id are owned through the unique customer mapping.
    expect(findPaymentFailedNotice([sub({ metadata: {} })], ctx)).not.toBeNull();
  });

  it("falls back to the portal when the hosted invoice link is missing or not Stripe's", () => {
    expect(findPaymentFailedNotice([sub({}, { hosted_invoice_url: null })], ctx)?.payUrl).toBeNull();
    expect(findPaymentFailedNotice([sub({}, { hosted_invoice_url: "https://evil.example/i/x" })], ctx)?.payUrl).toBeNull();
  });

  it("finds the lapsed subscription among healthy ones", () => {
    expect(findPaymentFailedNotice([sub({ id: "sub_0", status: "active" }), sub({ id: "sub_1" })], ctx)?.invoiceId).toBe("in_1");
  });

  it("prefers the renewal over another failed bill, whatever the list order", () => {
    const proration = sub({ id: "sub_p" }, { id: "in_proration", billing_reason: "subscription_update", hosted_invoice_url: null, created: START + 2 * DAY });
    const renewal = sub({ id: "sub_r" }, { id: "in_renewal", billing_reason: "subscription_cycle", created: START });
    expect(findPaymentFailedNotice([proration, renewal], ctx)?.invoiceId).toBe("in_renewal");
    expect(findPaymentFailedNotice([renewal, proration], ctx)?.invoiceId).toBe("in_renewal");
  });

  it("then prefers a bill Stripe can take payment for, then the newest", () => {
    const noLink = sub({ id: "sub_a" }, { id: "in_no_link", billing_reason: "subscription_cycle", hosted_invoice_url: null, created: START + 5 * DAY });
    const payable = sub({ id: "sub_b" }, { id: "in_payable", billing_reason: "subscription_cycle", created: START });
    expect(findPaymentFailedNotice([noLink, payable], ctx)?.invoiceId).toBe("in_payable");
    const older = sub({ id: "sub_c" }, { id: "in_older", billing_reason: "subscription_cycle", created: START });
    const newer = sub({ id: "sub_d" }, { id: "in_newer", billing_reason: "subscription_cycle", created: START + DAY });
    expect(findPaymentFailedNotice([older, newer], ctx)?.invoiceId).toBe("in_newer");
  });
});

describe("hasLapsedSubscription", () => {
  const lapsed = new Set(["past_due", "unpaid", "incomplete"]);
  it("matches the checkout gate, including a first payment that never completed", () => {
    expect(hasLapsedSubscription([sub({ status: "incomplete", latest_invoice: null })], lapsed)).toBe(true);
    expect(hasLapsedSubscription([sub({ status: "past_due" })], lapsed)).toBe(true);
    expect(hasLapsedSubscription([sub({ status: "active" }), sub({ status: "canceled" })], lapsed)).toBe(false);
  });
});

describe("trustedHostedInvoiceUrl", () => {
  it("accepts only Stripe's hosted invoice host and path", () => {
    expect(trustedHostedInvoiceUrl("https://invoice.stripe.com/i/acct_1/x")).toBe("https://invoice.stripe.com/i/acct_1/x");
    expect(trustedHostedInvoiceUrl("http://invoice.stripe.com/i/acct_1/x")).toBeNull();
    expect(trustedHostedInvoiceUrl("https://invoice.stripe.com.evil.example/i/x")).toBeNull();
    expect(trustedHostedInvoiceUrl("https://user@invoice.stripe.com/i/x")).toBeNull();
    expect(trustedHostedInvoiceUrl("https://invoice.stripe.com/other")).toBeNull();
    expect(trustedHostedInvoiceUrl("not a url")).toBeNull();
    expect(trustedHostedInvoiceUrl(42)).toBeNull();
  });
});
