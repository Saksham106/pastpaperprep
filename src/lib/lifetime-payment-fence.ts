import type { createStripeClient } from "@/lib/stripe";

type StripeClient = ReturnType<typeof createStripeClient>;

// Webhook fulfilment can lag behind a buyer who has already paid, so access
// rows alone cannot fence a second purchase. Any completed Lifetime Checkout
// whose payment is taken or still in flight blocks new checkouts until Stripe
// shows it refunded or failed. Unknown payment state fails closed.
export async function hasUnsettledLifetimePayment(stripe: StripeClient, customerId: string): Promise<boolean> {
  let startingAfter: string | undefined;
  do {
    const page = await stripe.checkout.sessions.list({
      customer: customerId,
      status: "complete",
      limit: 100,
      expand: ["data.payment_intent.latest_charge"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const session of page.data) {
      if (session.mode !== "payment" || session.metadata?.purchase_type !== "lifetime") continue;
      const intent = session.payment_intent;
      if (!intent || typeof intent === "string") return true;
      if (intent.status === "canceled" || intent.status === "requires_payment_method") continue;
      const charge = intent.latest_charge;
      if (intent.status === "succeeded" && charge && typeof charge !== "string" && charge.refunded) continue;
      return true;
    }
    if (!page.has_more) return false;
    startingAfter = page.data.at(-1)?.id;
    if (!startingAfter) throw new Error("Stripe Checkout Session pagination did not advance");
  } while (true);
}

// Expiring is how a new checkout supersedes an abandoned one. A session that
// did not end up expired (e.g. it completed meanwhile) must stop the new one.
export async function expireOpenCheckoutSession(stripe: StripeClient, sessionId: string): Promise<void> {
  const expired = await stripe.checkout.sessions.expire(sessionId);
  if (expired?.status !== "expired") throw new Error("Checkout Session could not be expired");
}
