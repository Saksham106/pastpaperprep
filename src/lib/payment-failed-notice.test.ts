import { describe, expect, it } from "vitest";
import { findPaymentFailedNotice, trustedHostedInvoiceUrl, type SubscriptionLike } from "@/lib/payment-failed-notice";

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

  it("gives no date while a pause changes the access rules", () => {
    expect(findPaymentFailedNotice([sub({ pause_collection: { behavior: "void" } })], ctx)).toMatchObject({ accessEndsAt: null, accessEnded: false });
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
