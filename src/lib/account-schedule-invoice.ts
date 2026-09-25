import type Stripe from "stripe";

const APP_OWNER = "pastpaperprep";

function id(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value && typeof value.id === "string" ? value.id : null;
}

/**
 * A schedule phase switches the live subscription before Stripe finalizes its
 * renewal invoice. Only an app-owned second phase needs this extra payment
 * fence; other subscriptions keep their existing webhook behavior.
 * Throws so Stripe retries the event instead of granting uncollected access.
 */
export async function verifyScheduledRenewalPayment(stripe: Stripe, subscription: Stripe.Subscription): Promise<"unmanaged" | "phase-zero" | "unpaid-phase-two" | "paid-phase-two"> {
  const scheduleId = id(subscription.schedule);
  if (!scheduleId) return "unmanaged";
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId, {}, { timeout: 60_000 });
  if (schedule.metadata?.owner !== APP_OWNER) return "unmanaged";
  const item = subscription.items.data.length === 1 ? subscription.items.data[0] : null;
  if (!item || schedule.id !== scheduleId || id(schedule.subscription) !== subscription.id || schedule.customer !== subscription.customer ||
    schedule.metadata.user_id !== subscription.metadata.user_id || schedule.metadata.subscription_id !== subscription.id ||
    !schedule.metadata.ownership_id || schedule.phases.length !== 2 || !schedule.current_phase ||
    schedule.phases[0].end_date !== schedule.phases[1].start_date) {
    throw new Error("Unverifiable app-owned schedule");
  }
  if (schedule.current_phase.start_date === schedule.phases[0].start_date) return "phase-zero";
  const target = schedule.phases[1];
  const targetItem = target.items.length === 1 ? target.items[0] : null;
  const currentPrice = id(item.price);
  if (schedule.current_phase.start_date !== target.start_date || item.current_period_start !== target.start_date ||
    !targetItem || id(targetItem.price) !== currentPrice || item.quantity !== targetItem.quantity ||
    target.metadata?.user_id !== subscription.metadata.user_id || target.metadata.product_id !== subscription.metadata.product_id ||
    (target.metadata.selected_bank_ids || "") !== (subscription.metadata.selected_bank_ids || "") ||
    (target.metadata.price_id || "") !== (subscription.metadata.price_id || "") ||
    (target.metadata.billing_interval || "") !== (subscription.metadata.billing_interval || "")) {
    throw new Error("Scheduled phase does not match live subscription");
  }
  if (subscription.status !== "active" && subscription.status !== "trialing") return "unpaid-phase-two";
  const invoiceId = id(subscription.latest_invoice);
  if (!invoiceId) throw new Error("Scheduled renewal invoice missing");
  const invoice = await stripe.invoices.retrieve(invoiceId, {}, { timeout: 60_000 });
  if (invoice.id !== invoiceId || invoice.customer !== subscription.customer || invoice.status !== "paid" ||
    invoice.billing_reason !== "subscription_cycle" || invoice.collection_method !== "charge_automatically" ||
    invoice.parent?.type !== "subscription_details" || invoice.parent.subscription_details?.subscription !== subscription.id ||
    invoice.lines.has_more || !invoice.lines.data.some((line) =>
      line.parent?.type === "subscription_item_details" &&
      line.parent.subscription_item_details?.subscription === subscription.id &&
      line.period.start === item.current_period_start && line.period.end === item.current_period_end
    )) throw new Error("Scheduled renewal invoice is not verified paid");
  if (!Number.isSafeInteger(invoice.amount_due) || invoice.amount_due < 0 ||
    !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid < invoice.amount_due) {
    throw new Error("Scheduled renewal payment amount is inconsistent");
  }
  if (invoice.amount_due > 0) {
    const payments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 100 }, { timeout: 60_000 });
    if (payments.has_more || !payments.data.some((payment) =>
      payment.invoice === invoiceId && payment.status === "paid" && payment.payment.type === "payment_intent" &&
      typeof payment.payment.payment_intent === "string" && typeof payment.amount_paid === "number" && payment.amount_paid >= invoice.amount_due
    )) throw new Error("Scheduled renewal has no collected Stripe payment");
  }
  return "paid-phase-two";
}
