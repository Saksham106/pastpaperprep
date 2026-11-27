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
  attempt_count?: unknown; next_payment_attempt?: unknown; hosted_invoice_url?: unknown; billing_reason?: unknown; created?: unknown;
};
export type SubscriptionLike = {
  id: string;
  status: string;
  customer: unknown;
  metadata?: Record<string, string> | null;
  pause_collection?: unknown;
  schedule?: unknown;
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

/** Ownership rule shared with /api/billing/subscription: the mapped customer, and no conflicting owner. */
function ownedBy(subscription: SubscriptionLike, customerId: string, userId: string) {
  const owner = subscription.metadata?.user_id;
  return customerIdOf(subscription.customer) === customerId && (owner === undefined || owner === userId);
}

/**
 * Would checkout refuse a new purchase for this account? Mirrors the checkout gate, which blocks on
 * any past_due, unpaid or incomplete subscription under the customer (not only the one shown).
 */
export function hasLapsedSubscription(subscriptions: readonly SubscriptionLike[], lapsedStatuses: ReadonlySet<string>) {
  return subscriptions.some((subscription) => lapsedStatuses.has(subscription.status));
}

type Candidate = { notice: PaymentFailedNotice; renewal: boolean; created: number };

/**
 * The failed renewal to show, if any. Reads every subscription listed for this customer with
 * `latest_invoice` expanded, and picks deliberately: a renewal (`subscription_cycle`) before
 * other bills such as a proration, then one Stripe can take payment for on its hosted page,
 * then the newest. Display only: anything unexpected (another owner, a different customer, an
 * invoice that is not open with a failed attempt) shows nothing.
 */
export function findPaymentFailedNotice(
  subscriptions: readonly SubscriptionLike[],
  { customerId, userId, nowSeconds }: { customerId: string; userId: string; nowSeconds: number },
): PaymentFailedNotice | null {
  const candidates: Candidate[] = [];
  for (const subscription of subscriptions) {
    if (!LAPSED.has(subscription.status) || !ownedBy(subscription, customerId, userId)) continue;

    const invoice = subscription.latest_invoice as InvoiceLike | null | undefined;
    if (!invoice || typeof invoice !== "object" || typeof invoice.id !== "string") continue;
    if (invoice.status !== "open" || customerIdOf(invoice.customer) !== customerId) continue;
    const amount = invoice.amount_remaining;
    if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) continue;
    if (typeof invoice.currency !== "string" || !/^[a-z]{3}$/.test(invoice.currency)) continue;
    // A renewal that has not been attempted yet has not failed.
    if (typeof invoice.attempt_count !== "number" || invoice.attempt_count < 1) continue;

    let accessEndsAt: string | null = null;
    // Stripe stopped retrying: the webhook revokes an `unpaid` subscription.
    let accessEnded = subscription.status === "unpaid";
    const items = subscription.items?.data;
    const item = Array.isArray(items) && items.length === 1 ? items[0] : null;
    const periodStart = unixSeconds(item?.current_period_start);
    const periodEnd = unixSeconds(item?.current_period_end);
    // Mirrors the webhook's past-due grace (buildSubscriptionSync). A pause or a scheduled plan change
    // can change what the webhook grants (an unpaid scheduled target gets no grace), so no date then.
    if (subscription.status === "past_due" && !subscription.pause_collection && subscription.schedule == null && periodStart && periodEnd) {
      const graceEnd = Math.min(periodStart + PAST_DUE_GRACE_SECONDS, periodEnd);
      accessEndsAt = iso(graceEnd);
      if (graceEnd <= nowSeconds) accessEnded = true;
    }
    const retry = unixSeconds(invoice.next_payment_attempt);

    candidates.push({
      renewal: invoice.billing_reason === "subscription_cycle",
      created: unixSeconds(invoice.created) ?? 0,
      notice: {
        invoiceId: invoice.id,
        amountCents: amount,
        currency: invoice.currency,
        accessEndsAt: accessEnded ? null : accessEndsAt,
        accessEnded,
        nextRetryAt: retry && retry > nowSeconds ? iso(retry) : null,
        payUrl: trustedHostedInvoiceUrl(invoice.hosted_invoice_url),
      },
    });
  }
  candidates.sort((a, b) =>
    Number(b.renewal) - Number(a.renewal) ||
    Number(Boolean(b.notice.payUrl)) - Number(Boolean(a.notice.payUrl)) ||
    b.created - a.created);
  return candidates[0]?.notice ?? null;
}
