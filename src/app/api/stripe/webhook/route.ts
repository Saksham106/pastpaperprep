import { NextResponse } from "next/server";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripePriceAllowedForProduct } from "@/lib/stripe-config";
import { buildSubscriptionSync, getSubscriptionEventReference } from "@/lib/stripe-subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let config;
  try {
    config = getStripeConfig();
  } catch {
    return NextResponse.json({ error: "Stripe webhooks are not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const rawBody = await request.text();
  const stripe = createStripeClient(config.secretKey);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let reference;
  try {
    reference = getSubscriptionEventReference(event);
  } catch {
    return NextResponse.json({ error: "Invalid subscription event" }, { status: 400 });
  }
  if (!reference) return NextResponse.json({ received: true });

  let currentSubscription;
  try {
    currentSubscription = await stripe.subscriptions.retrieve(reference.subscriptionId);
  } catch {
    return NextResponse.json({ error: "Could not refresh subscription" }, { status: 500 });
  }

  let sync;
  try {
    sync = buildSubscriptionSync(
      { ...event, data: { object: currentSubscription } },
      (productId, priceId) => isStripePriceAllowedForProduct(productId, priceId, config),
    );
  } catch {
    const admin = createAdminClient();
    const { error } = await admin.rpc("invalidate_stripe_subscription_event", {
      p_event_id: event.id,
      p_event_created: event.created,
      p_subscription_id: reference.subscriptionId,
    });
    if (error) return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    return NextResponse.json({ received: true });
  }
  if (!sync) return NextResponse.json({ received: true });

  const admin = createAdminClient();
  const { error } = await admin.rpc("apply_stripe_subscription_event", {
    p_event_id: sync.eventId,
    p_event_created: sync.eventCreated,
    p_subscription_id: sync.subscriptionId,
    p_customer_id: sync.customerId,
    p_user_id: sync.userId,
    p_product_id: sync.productId,
    p_status: sync.status,
    p_starts_at: sync.startsAt,
    p_expires_at: sync.expiresAt,
  });
  if (error) {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
