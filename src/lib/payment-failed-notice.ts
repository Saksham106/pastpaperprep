import { PAST_DUE_GRACE_SECONDS } from "@/lib/stripe-subscriptions";

/** What the browser needs to show the failed-renewal notice. Nothing here identifies the customer. */
export type PaymentFailedNotice = {
  invoiceId: string;
  amountCents: number;
  currency: string;
  /** When in-app access ends if the bill stays unpaid (the past-due grace), or null when unknown. */
  accessEndsAt: string | null;
  /** Access has already stopped: the grace ran out, or Stripe gave up retrying (`unpaid`). */
  accessEnded: boolean;
  /** Stripe's next automatic retry, when one is scheduled. */
  nextRetryAt: string | null;
  /** Stripe's hosted page for this exact invoice; null sends the student to the billing portal instead. */
  payUrl: string | null;
};

type InvoiceLike = {
  id?: unknown; object?: unknown; status?: unknown; customer?: unknown; amount_remaining?: unknown; currency?: unknown;
  attempt_count?: unknown; next_payment_attempt?: unknown; hosted_invoice_url?: unknown;
};
export type SubscriptionLike = {
  id: string;
  status: string;
  customer: unknown;
  metadata?: Record<string, string> | null;
  pause_collection?: unknown;
  latest_invoice?: unknown;
  items?: { data?: { current_period_start?: unknown; current_period_end?: unknown }[] };
};

const LAPSED = new Set(["past_due", "unpaid"]);

function customerIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  return null;
}

function unixSeconds(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function iso(seconds: number) {
  return new Date(seconds * 1000).toISOString();
}

/** Only Stripe's own hosted invoice pages, never another host smuggled into the field. */
export function trustedHostedInvoiceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "invoice.stripe.com" && !url.username && !url.password && !url.port && url.pathname.startsWith("/i/") ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * The failed renewal to show, if any. Reads subscriptions listed for this customer with
 * `latest_invoice` expanded. Display only: anything unexpected (another owner, a different
 * customer, an invoice that is not open with a failed attempt) shows nothing.
 */
export function findPaymentFailedNotice(
  subscriptions: readonly SubscriptionLike[],
  { customerId, userId, nowSeconds }: { customerId: string; userId: string; nowSeconds: number },
): PaymentFailedNotice | null {
  for (const subscription of subscriptions) {
    if (!LAPSED.has(subscription.status)) continue;
    if (customerIdOf(subscription.customer) !== customerId) continue;
    const owner = subscription.metadata?.user_id;
    if (owner !== undefined && owner !== userId) continue;

    const invoice = subscription.latest_invoice as InvoiceLike | null | undefined;
    if (!invoice || typeof invoice !== "object" || typeof invoice.id !== "string") continue;
    if (invoice.status !== "open" || customerIdOf(invoice.customer) !== customerId) continue;
    const amount = invoice.amount_remaining;
    if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) continue;
    if (typeof invoice.currency !== "string" || !/^[a-z]{3}$/.test(invoice.currency)) continue;
    // A renewal that has not been attempted yet has not failed.
    if (typeof invoice.attempt_count !== "number" || invoice.attempt_count < 1) continue;

    let accessEndsAt: string | null = null;
    let accessEnded = subscription.status === "unpaid";
    const items = subscription.items?.data;
    const item = Array.isArray(items) && items.length === 1 ? items[0] : null;
    const periodStart = unixSeconds(item?.current_period_start);
    const periodEnd = unixSeconds(item?.current_period_end);
    // Mirrors the webhook's past-due grace (buildSubscriptionSync). A pause changes that rule, so no date then.
    if (subscription.status === "past_due" && !subscription.pause_collection && periodStart && periodEnd) {
      const graceEnd = Math.min(periodStart + PAST_DUE_GRACE_SECONDS, periodEnd);
      accessEndsAt = iso(graceEnd);
      if (graceEnd <= nowSeconds) accessEnded = true;
    }
    const retry = unixSeconds(invoice.next_payment_attempt);

    return {
      invoiceId: invoice.id,
      amountCents: amount,
      currency: invoice.currency,
      accessEndsAt: accessEnded ? null : accessEndsAt,
      accessEnded,
      nextRetryAt: retry && retry > nowSeconds ? iso(retry) : null,
      payUrl: trustedHostedInvoiceUrl(invoice.hosted_invoice_url),
    };
  }
  return null;
}
