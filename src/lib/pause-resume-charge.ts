import type Stripe from "stripe";
import { PAUSE_RESUME_MARGIN_MS, PAUSE_RESUMES_AT_KEY } from "@/lib/subscription-pause";

/**
 * Early resume for subscriptions on Stripe's flexible billing mode.
 *
 * In flexible mode Stripe counts a voided paused month as already billed, so restarting the billing cycle either
 * charges nothing (`proration_behavior: none`) or only the days past the old period end (`always_invoice`).
 * So the month is charged first as a separate one-off invoice for the full plan price, and the pause is lifted
 * (billing date restarted today, no Stripe charge) only after that payment has gone through.
 * Proof for the webhook: the subscription records the invoice id, and `verifyResumeInvoice` checks it.
 */

/** Subscription metadata: the one-off invoice that paid for the period started by an early resume. */
export const RESUME_INVOICE_KEY = "pause_resume_invoice";
export const RESUME_INVOICE_PURPOSE = "pause_resume";
/** The resume invoice must be paid within this window before the period it pays for starts. */
export const RESUME_PAYMENT_WINDOW_SECONDS = 15 * 60;
const SKEW_MS = 60_000;

export class ResumePaymentDeclined extends Error {}
export class ResumeUnavailable extends Error {}

const idOf = (value: unknown): string | null => typeof value === "string" ? value : value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : null;

export async function chargeAndResumeFlexible(stripe: Stripe, subscription: Stripe.Subscription, input: { intentId: string; amountCents: number; currency: string; nowMs: number }): Promise<{ invoiceId: string }> {
  const customer = idOf(subscription.customer);
  const paymentMethod = idOf(subscription.default_payment_method);
  if (!customer || !paymentMethod) throw new ResumeUnavailable("No saved card on this plan");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new ResumeUnavailable("Plan price unavailable");
  const metadata = { purpose: RESUME_INVOICE_PURPOSE, subscription_id: subscription.id, user_id: subscription.metadata?.user_id ?? "", expected_amount: String(input.amountCents), intent_id: input.intentId };
  const key = (step: string) => ({ idempotencyKey: `pastpaperprep-resume-${step}-${input.intentId}`, timeout: 30_000 });

  // 1) The month's charge, on its own invoice: no pending items, no coupons, the plan's saved card.
  const invoice = await stripe.invoices.create({
    customer, collection_method: "charge_automatically", auto_advance: false, pending_invoice_items_behavior: "exclude",
    currency: input.currency, default_payment_method: paymentMethod, discounts: [], description: "PastPaperPrep: your plan restarts today", metadata,
  }, key("invoice"));
  await stripe.invoiceItems.create({ customer, invoice: invoice.id, amount: input.amountCents, currency: input.currency, discountable: false, description: "PastPaperPrep plan, one month from today", metadata }, key("item"));
  await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: false }, key("finalize"));
  let paid: Stripe.Invoice;
  try {
    paid = await stripe.invoices.pay(invoice.id, { payment_method: paymentMethod, off_session: true }, key("pay"));
  } catch (error) {
    await stripe.invoices.voidInvoice(invoice.id).catch(() => undefined);
    if ((error as { type?: string })?.type === "StripeCardError") throw new ResumePaymentDeclined("Payment declined");
    throw error;
  }
  if (paid.status !== "paid" || paid.amount_paid < input.amountCents) {
    await stripe.invoices.voidInvoice(invoice.id).catch(() => undefined);
    throw new ResumePaymentDeclined("Payment not completed");
  }

  // 2) Paid: lift the pause and restart the billing date today, without another Stripe charge. Moving the resume
  // marker means the period this starts is the only one the invoice can prove.
  const marker = new Date(input.nowMs - SKEW_MS + PAUSE_RESUME_MARGIN_MS).toISOString();
  try {
    await stripe.subscriptions.update(subscription.id, {
      pause_collection: "", billing_cycle_anchor: "now", proration_behavior: "none",
      metadata: { [PAUSE_RESUMES_AT_KEY]: marker, [RESUME_INVOICE_KEY]: invoice.id },
    }, key("subscription"));
  } catch (error) {
    // The update may have gone through despite the error; refund only when it clearly didn't.
    const current = await stripe.subscriptions.retrieve(subscription.id).catch(() => null);
    if (current && !current.pause_collection && current.metadata?.[RESUME_INVOICE_KEY] === invoice.id) return { invoiceId: invoice.id };
    if (current) await refundInvoice(stripe, invoice.id).catch(() => undefined);
    throw error;
  }
  return { invoiceId: invoice.id };
}

async function refundInvoice(stripe: Stripe, invoiceId: string) {
  const payments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 10 });
  for (const payment of payments.data) {
    const intent = payment.payment?.type === "payment_intent" ? idOf(payment.payment.payment_intent) : null;
    if (payment.status === "paid" && intent) await stripe.refunds.create({ payment_intent: intent, metadata: { reason: "pause_resume_failed", invoice: invoiceId } }, { idempotencyKey: `pastpaperprep-resume-refund-${invoiceId}` });
  }
}

/**
 * Proof that the current period was paid by an early-resume invoice: the subscription points at it, it's a paid,
 * server-marked invoice for this subscription and customer with the expected amount, and it was paid just before
 * this period started (so it can never prove a later period).
 */
export async function verifyResumeInvoice(stripe: Stripe, subscription: Stripe.Subscription): Promise<boolean> {
  const invoiceId = subscription.metadata?.[RESUME_INVOICE_KEY];
  const item = subscription.items?.data?.length === 1 ? subscription.items.data[0] : null;
  if (!invoiceId || !item) return false;
  const invoice = await stripe.invoices.retrieve(invoiceId, {}, { timeout: 60_000 });
  const expected = Number(invoice.metadata?.expected_amount);
  const paidAt = invoice.status_transitions?.paid_at;
  return invoice.id === invoiceId && invoice.status === "paid" && idOf(invoice.customer) === idOf(subscription.customer) &&
    invoice.metadata?.purpose === RESUME_INVOICE_PURPOSE && invoice.metadata?.subscription_id === subscription.id &&
    Number.isSafeInteger(expected) && expected > 0 && invoice.amount_paid >= expected &&
    typeof paidAt === "number" && paidAt <= item.current_period_start + 60 && item.current_period_start - paidAt <= RESUME_PAYMENT_WINDOW_SECONDS;
}
