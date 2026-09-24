import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { commissionRecordForInvoice, subscriptionIdForInvoice, adjustmentForRefund, adjustmentForDispute } from "@/lib/referral-commission";

function idOf(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function reconcileReferralRefunds(stripe: Stripe, admin: SupabaseClient, invoiceId: string, chargeId: string): Promise<void> {
  const refunds = await stripe.refunds.list({ charge: chargeId, limit: 100 });
  if (refunds.has_more) throw new Error("Referral refund list requires pagination");
  if (!refunds.data.some((refund) => refund.status === "succeeded")) return;
  const { data: saved, error: savedError } = await admin.from("referral_commissions")
    .select("id, commission_cents, gross_collected_cents").eq("stripe_invoice_id", invoiceId).maybeSingle();
  if (savedError) throw savedError;
  if (!saved) return;
  for (const refund of refunds.data) {
    const adjustment = adjustmentForRefund(refund, saved);
    if (!adjustment) continue;
    const { error: adjustmentError } = await admin.from("referral_adjustments")
      .upsert(adjustment, { onConflict: "stripe_refund_id", ignoreDuplicates: true });
    if (adjustmentError) throw adjustmentError;
  }
}

async function invoiceForCharge(stripe: Stripe, chargeId: string): Promise<string | null> {
  const charge = await stripe.charges.retrieve(chargeId);
  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId) return null;
  const payments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentIntentId }, status: "paid", limit: 100 });
  if (payments.has_more) throw new Error("Referral payment matches require pagination");
  const matches = payments.data.filter((payment) => payment.status === "paid" && payment.payment.type === "payment_intent" && idOf(payment.payment.payment_intent) === paymentIntentId);
  if (matches.length > 1) throw new Error("Ambiguous invoice payment for refunded charge");
  return matches.length === 1 ? idOf(matches[0].invoice) : null;
}

export async function reconcileReferralDisputes(stripe: Stripe, admin: SupabaseClient, invoiceId: string, chargeId: string): Promise<void> {
  const disputes = await stripe.disputes.list({ charge: chargeId, limit: 100 });
  if (disputes.has_more) throw new Error("Referral dispute list requires pagination");
  if (!disputes.data.length) return;
  const { data: saved, error } = await admin.from("referral_commissions").select("id, commission_cents, gross_collected_cents").eq("stripe_invoice_id", invoiceId).maybeSingle();
  if (error) throw error;
  if (!saved) return;
  for (const dispute of disputes.data) {
    // Won disputes release an immutable hold; never rewrite a settled adjustment.
    const states = dispute.status === "won" || dispute.status === "lost" ? [{ ...dispute, status: "under_review" as const }, dispute] : [dispute];
    for (const state of states) {
      const adjustment = adjustmentForDispute(state, saved);
      if (!adjustment) continue;
      const { error: adjustmentError } = await admin.from("referral_adjustments")
        .upsert(adjustment, { onConflict: "stripe_dispute_id,reason", ignoreDuplicates: true });
      if (adjustmentError) throw adjustmentError;
    }
  }
}

export async function processReferralDisputeChanged(stripe: Stripe, admin: SupabaseClient, eventDispute: Stripe.Dispute): Promise<void> {
  const dispute = await stripe.disputes.retrieve(eventDispute.id);
  const chargeId = idOf(dispute.charge);
  if (!chargeId) return;
  const invoiceId = await invoiceForCharge(stripe, chargeId);
  if (invoiceId) await reconcileReferralDisputes(stripe, admin, invoiceId, chargeId);
}

export async function processReferralChargeRefunded(stripe: Stripe, admin: SupabaseClient, eventCharge: Stripe.Charge): Promise<void> {
  const invoiceId = await invoiceForCharge(stripe, eventCharge.id);
  if (invoiceId) await reconcileReferralRefunds(stripe, admin, invoiceId, eventCharge.id);
}

export async function processReferralInvoicePaid(stripe: Stripe, admin: SupabaseClient, eventInvoice: Stripe.Invoice): Promise<void> {
  if (eventInvoice.billing_reason !== "subscription_create" || !eventInvoice.id) return;
  const invoice = await stripe.invoices.retrieve(eventInvoice.id);
  if (invoice.status !== "paid" || invoice.billing_reason !== "subscription_create") return;
  const subscriptionId = subscriptionIdForInvoice(invoice);
  const customerId = idOf(invoice.customer);
  const paidAt = invoice.status_transitions.paid_at;
  if (!subscriptionId || !customerId || !paidAt) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata.user_id;
  const referralCode = subscription.metadata.referral_code;
  if (!userId || !referralCode || idOf(subscription.customer) !== customerId) return;
  const { data: attribution, error: attributionError } = await admin.from("referral_attributions")
    .select("partner_code, attributed_at").eq("user_id", userId).maybeSingle();
  if (attributionError) throw attributionError;
  if (!attribution || attribution.partner_code !== referralCode) return;
  const { data: partner, error: partnerError } = await admin.from("referral_partners")
    .select("commission_bps").eq("code", referralCode).eq("active", true).maybeSingle();
  if (partnerError) throw partnerError;
  if (!partner) return;

  const invoicePayments = await stripe.invoicePayments.list({ invoice: invoice.id, status: "paid", limit: 100 });
  if (invoicePayments.has_more) throw new Error("Referral invoice has too many payments to verify");
  const collected = invoicePayments.data.filter((item) => item.status === "paid" && item.payment.type === "payment_intent" && typeof item.amount_paid === "number" && item.amount_paid > 0);
  // A single collected payment keeps every refund traceable to this invoice.
  if (collected.length > 1) throw new Error("Multiple collected payments require manual referral reconciliation");
  if (collected.length !== 1 || collected[0].amount_paid !== invoice.amount_paid) return;
  const paymentIntentId = idOf(collected[0].payment.payment_intent);
  if (!paymentIntentId) return;
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== "succeeded" || paymentIntent.currency !== invoice.currency
    || !Number.isSafeInteger(paymentIntent.amount_received) || paymentIntent.amount_received < collected[0].amount_paid) return;
  const record = commissionRecordForInvoice(invoice, { userId, partnerCode: referralCode, commissionBps: partner.commission_bps }, collected[0].amount_paid);
  if (!record) return;
  const { data: result, error } = await admin.rpc("record_first_referral_commission", {
    p_user_id: record.user_id,
    p_partner_code: record.partner_code,
    p_invoice_id: record.stripe_invoice_id,
    p_subscription_id: record.stripe_subscription_id,
    p_customer_id: customerId,
    p_invoice_payment_id: collected[0].id,
    p_paid_at: new Date(paidAt * 1000).toISOString(),
    p_currency: record.currency,
    p_gross_cents: record.gross_collected_cents,
    p_tax_cents: record.tax_cents,
    p_discount_cents: record.discount_cents,
    p_commission_cents: record.commission_cents,
  });
  if (error) throw error;
  if (!(["recorded", "duplicate", "ineligible"] as unknown[]).includes(result)) throw new Error("Unexpected referral ledger result");

  // Reconcile a refund that landed before this invoice webhook or during retry.
  const chargeId = idOf(paymentIntent.latest_charge);
  if (!chargeId || result === "ineligible") return;
  await reconcileReferralRefunds(stripe, admin, invoice.id, chargeId);
  await reconcileReferralDisputes(stripe, admin, invoice.id, chargeId);
}
