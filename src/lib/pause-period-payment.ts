import type Stripe from "stripe";
import { isPauseRelevant } from "@/lib/subscription-pause";

const idOf = (value: unknown): string | null => typeof value === "string" ? value : value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : null;

/** Whether a pause touches the subscription's current period (see `isPauseRelevant`). */
export function subscriptionPauseRelevant(subscription: Stripe.Subscription): boolean {
  const item = subscription.items?.data?.length === 1 ? subscription.items.data[0] : null;
  if (!item || !Number.isSafeInteger(item.current_period_start)) return Boolean(subscription.pause_collection);
  return isPauseRelevant(Boolean(subscription.pause_collection), subscription.metadata, item.current_period_start);
}

/**
 * True only when the latest invoice is a paid invoice of this subscription with a line ending exactly at the
 * current period end. Voided pause invoices, drafts and open renewals return false. Lookup failures throw, so the
 * webhook retries instead of guessing.
 */
export async function verifyCurrentPeriodPaid(stripe: Stripe, subscription: Stripe.Subscription): Promise<boolean> {
  const item = subscription.items?.data?.length === 1 ? subscription.items.data[0] : null;
  const invoiceId = idOf(subscription.latest_invoice);
  if (!item || !invoiceId) return false;
  const invoice = await stripe.invoices.retrieve(invoiceId, {}, { timeout: 60_000 });
  if (invoice.id !== invoiceId || idOf(invoice.customer) !== idOf(subscription.customer) || invoice.status !== "paid") return false;
  if (invoice.parent?.type !== "subscription_details" || idOf(invoice.parent.subscription_details?.subscription) !== subscription.id) return false;
  if (invoice.lines.has_more) return false;
  const coversPeriod = invoice.lines.data.some((line) =>
    line.parent?.type === "subscription_item_details" &&
    idOf(line.parent.subscription_item_details?.subscription) === subscription.id &&
    line.period.end === item.current_period_end && line.period.start >= item.current_period_start);
  return coversPeriod && Number.isSafeInteger(invoice.amount_due) && Number.isSafeInteger(invoice.amount_paid) && invoice.amount_due >= 0 && invoice.amount_paid >= invoice.amount_due;
}
