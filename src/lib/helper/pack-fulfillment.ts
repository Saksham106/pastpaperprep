import "server-only";
import type Stripe from "stripe";
import { HELPER_PACK_CURRENCY, helperPack } from "@/lib/helper/credits";

// Webhook side of Pepper credit packs. A pack is credited only after the session, its single line item, the
// PaymentIntent and the customer mapping all match the server's fixed pack list; the SQL function credits each
// Checkout Session once and refuses a payment already refunded or disputed.

type Admin = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
type StripeReads = {
  checkout: { sessions: { listLineItems: Stripe["checkout"]["sessions"]["listLineItems"] } };
  paymentIntents: { retrieve: Stripe["paymentIntents"]["retrieve"] };
};
export type WebhookResult = { status: number; body: Record<string, unknown> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const received: WebhookResult = { status: 200, body: { received: true } };
const invalid = (error: string): WebhookResult => ({ status: 400, body: { error } });
const retry = (error: string): WebhookResult => ({ status: 500, body: { error } });

export async function fulfillHelperPack(stripe: StripeReads, admin: Admin, session: Stripe.Checkout.Session, eventCreated: number): Promise<WebhookResult> {
  const metadata = session.metadata ?? {};
  const userId = session.client_reference_id ?? "";
  const pack = helperPack(metadata.pack_id);
  if (session.mode !== "payment" || !pack || !UUID.test(userId) || metadata.user_id !== userId ||
      metadata.credits !== String(pack.credits) || typeof metadata.billing_intent_id !== "string" || !metadata.billing_intent_id) {
    return invalid("Invalid credit pack checkout");
  }
  // `completed` also fires for unpaid asynchronous methods; those are credited on async_payment_succeeded.
  if (session.payment_status !== "paid") return received;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!customerId || !paymentIntentId || session.amount_total !== pack.amountCents || session.currency !== HELPER_PACK_CURRENCY) {
    return invalid("Credit pack payment verification failed");
  }

  try {
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2, expand: ["data.price.product"] });
    const item = items.data.length === 1 ? items.data[0] : null;
    const product = item?.price?.product;
    const productMetadata = product && typeof product === "object" && !("deleted" in product) ? product.metadata : null;
    if (items.has_more || !item || item.quantity !== 1 || item.amount_subtotal !== pack.amountCents || item.currency !== HELPER_PACK_CURRENCY ||
        item.price?.unit_amount !== pack.amountCents || item.price.currency !== HELPER_PACK_CURRENCY || item.price.recurring ||
        productMetadata?.purchase_type !== "helper_credits" || productMetadata?.pack_id !== pack.id) {
      return invalid("Credit pack line item verification failed");
    }
  } catch {
    return retry("Credit pack line item verification failed");
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {}, { timeout: 10_000 });
    const intentCustomer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
    if (intent.status !== "succeeded" || intentCustomer !== customerId || intent.amount_received !== pack.amountCents ||
        intent.currency !== HELPER_PACK_CURRENCY || intent.metadata?.user_id !== userId || intent.metadata?.pack_id !== pack.id ||
        intent.metadata?.purchase_type !== "helper_credits" || intent.metadata?.billing_intent_id !== metadata.billing_intent_id) {
      return invalid("Credit pack payment verification failed");
    }
  } catch {
    return retry("Credit pack payment verification failed");
  }

  const mapped = await admin.rpc("get_stripe_customer_id", { p_user_id: userId });
  if (mapped.error || mapped.data !== customerId) return retry("Credit pack customer ownership could not be verified");

  const credited = await admin.rpc("credit_helper_pack", {
    p_user_id: userId, p_pack_id: pack.id, p_credits: pack.credits, p_session_id: session.id, p_payment_intent_id: paymentIntentId,
    p_amount_cents: pack.amountCents, p_currency: HELPER_PACK_CURRENCY,
    p_purchased_at: new Date((session.created || eventCreated) * 1000).toISOString(),
  });
  if (credited.error || !["credited", "duplicate", "revoked"].includes(credited.data as string)) return retry("Credit pack fulfillment failed");
  return received;
}

/**
 * A refund or dispute on a pack payment removes that pack's unused credits (or stops it ever being credited).
 * Returns false when it could not be checked, so Stripe retries. Other payments are left alone.
 */
export async function revokeHelperPackPayment(stripe: StripeReads, admin: Admin, paymentIntentId: string, reason: "refunded" | "disputed"): Promise<boolean> {
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {}, { timeout: 10_000 });
    if (intent.metadata?.purchase_type !== "helper_credits") return true;
    const { error } = await admin.rpc("revoke_helper_pack", { p_payment_intent_id: paymentIntentId, p_reason: reason });
    return !error;
  } catch {
    return false;
  }
}
