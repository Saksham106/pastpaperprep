import type Stripe from "stripe";

type InvoiceAmounts = {
  id: string; billing_reason: string | null; status: string | null; amount_paid: number; subtotal: number;
  total_excluding_tax: number | null; total_taxes: Array<{ amount: number }> | null;
  total_discount_amounts: Array<{ amount: number }> | null; currency: string;
  parent: { type: string; subscription_details: { subscription: string | { id: string } } | null } | null;
  amount_paid_off_stripe?: number;
};
type Attribution = { userId: string; partnerCode: string; commissionBps: number };

export function subscriptionIdForInvoice(invoice: InvoiceAmounts): string | null {
  const parent = invoice.parent;
  if (parent?.type !== "subscription_details" || !parent.subscription_details) return null;
  const subscription = parent.subscription_details.subscription;
  return typeof subscription === "string" ? subscription : subscription.id;
}

export function commissionRecordForInvoice(invoice: InvoiceAmounts, attribution: Attribution, collectedCents: number) {
  const subscriptionId = subscriptionIdForInvoice(invoice);
  if (!invoice.id || !subscriptionId || invoice.status !== "paid" || invoice.billing_reason !== "subscription_create"
    || (invoice.amount_paid_off_stripe ?? 0) > 0 || !Number.isSafeInteger(collectedCents) || collectedCents <= 0) return null;
  const tax = (invoice.total_taxes ?? []).reduce((sum, item) => sum + item.amount, 0);
  const discount = (invoice.total_discount_amounts ?? []).reduce((sum, item) => sum + item.amount, 0);
  const preTax = invoice.total_excluding_tax;
  if (preTax === null || collectedCents > invoice.amount_paid || !Number.isSafeInteger(preTax) || preTax <= 0) return null;
  const base = Math.max(0, Math.min(preTax, collectedCents - tax));
  const commission = Math.floor(base * attribution.commissionBps / 10_000);
  if (commission <= 0) return null;
  return { user_id: attribution.userId, partner_code: attribution.partnerCode, stripe_invoice_id: invoice.id, stripe_subscription_id: subscriptionId, currency: invoice.currency, gross_collected_cents: collectedCents, tax_cents: tax, discount_cents: discount, commission_cents: commission, state: "pending" as const };
}

type Commission = { id: number; commission_cents: number; gross_collected_cents: number };
export function adjustmentForRefund(refund: Pick<Stripe.Refund, "id" | "amount" | "status">, commission: Commission) {
  if (refund.status !== "succeeded" || !Number.isSafeInteger(refund.amount) || refund.amount <= 0) return null;
  const amount = Math.min(commission.commission_cents, Math.floor(refund.amount * commission.commission_cents / commission.gross_collected_cents));
  return { commission_id: commission.id, stripe_refund_id: refund.id, stripe_dispute_id: null, amount_cents: amount, reason: "refund" as const };
}

export function adjustmentForDispute(dispute: Pick<Stripe.Dispute, "id" | "status">, commission: Commission) {
  if (dispute.status !== "won" && dispute.status !== "needs_response" && dispute.status !== "under_review" && dispute.status !== "lost") return null;
  return { commission_id: commission.id, stripe_refund_id: null, stripe_dispute_id: dispute.id, amount_cents: dispute.status === "won" ? -commission.commission_cents : dispute.status === "lost" ? 0 : commission.commission_cents, reason: dispute.status === "won" ? "dispute_won" as const : dispute.status === "lost" ? "dispute_lost" as const : "dispute" as const };
}
