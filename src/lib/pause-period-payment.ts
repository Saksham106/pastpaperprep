import type Stripe from "stripe";
import { isPauseRelevant, PAUSE_ACCESS_UNTIL_KEY } from "@/lib/subscription-pause";

const idOf = (value: unknown): string | null => typeof value === "string" ? value : value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : null;

/** Whether an app-owned pause touches the subscription's current period (see `isPauseRelevant`). */
export function subscriptionPauseRelevant(subscription: Stripe.Subscription): boolean {
  const item = subscription.items?.data?.length === 1 ? subscription.items.data[0] : null;
  if (!item || !Number.isSafeInteger(item.current_period_start)) return false;
  return isPauseRelevant(Boolean(subscription.pause_collection), subscription.metadata, item.current_period_start);
}

/** A paid invoice's snapshot of subscription metadata says it was billed while the app's pause window existed. */
export function invoiceFromPausedSubscription(invoice: Stripe.Invoice): boolean {
  const metadata = invoice.parent?.type === "subscription_details" ? invoice.parent.subscription_details?.metadata : null;
  return typeof metadata?.[PAUSE_ACCESS_UNTIL_KEY] === "string" && metadata[PAUSE_ACCESS_UNTIL_KEY] !== "";
}

/**
 * A non-prorated line that bills exactly this item for exactly its current recurring period, at its current price
 * and quantity. Partial periods, credits and other items never count as paying for the period.
 */
function paysCurrentPeriod(line: Stripe.InvoiceLineItem, subscription: Stripe.Subscription, item: Stripe.SubscriptionItem): boolean {
  const details = line.parent?.type === "subscription_item_details" ? line.parent.subscription_item_details : null;
  const linePrice = line.pricing?.type === "price_details" ? idOf(line.pricing.price_details?.price) : null;
  return details !== null && details !== undefined && details.proration === false &&
    idOf(details.subscription) === subscription.id && details.subscription_item === item.id &&
    line.period.start === item.current_period_start && line.period.end === item.current_period_end &&
    linePrice === item.price.id && line.quantity === item.quantity && typeof line.amount === "number" && line.amount >= 0;
}

/**
 * True when a paid invoice of this subscription contains a line paying for exactly the current period. Searches the
 * subscription's paid invoices instead of trusting the latest one, so a newer unrelated invoice can't hide the
 * period's payment. Zero-due (fully discounted) invoices count. Lookup failures throw so the webhook retries.
 */
export async function verifyCurrentPeriodPaid(stripe: Stripe, subscription: Stripe.Subscription): Promise<boolean> {
  const item = subscription.items?.data?.length === 1 ? subscription.items.data[0] : null;
  if (!item) return false;
  const invoices = await stripe.invoices.list({ subscription: subscription.id, status: "paid", limit: 100 }, { timeout: 60_000 });
  for (const invoice of invoices.data) {
    if (invoice.status !== "paid" || idOf(invoice.customer) !== idOf(subscription.customer)) continue;
    if (invoice.parent?.type !== "subscription_details" || idOf(invoice.parent.subscription_details?.subscription) !== subscription.id) continue;
    if (!Number.isSafeInteger(invoice.amount_due) || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_due < 0 || invoice.amount_paid < invoice.amount_due) continue;
    const lines = invoice.lines.has_more
      ? await stripe.invoices.listLineItems(invoice.id, { limit: 100 }, { timeout: 60_000 })
      : invoice.lines;
    if (lines.has_more) continue;
    if (lines.data.some((line) => paysCurrentPeriod(line, subscription, item))) return true;
  }
  return false;
}
