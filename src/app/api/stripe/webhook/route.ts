import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { processReferralInvoicePaid, processReferralChargeRefunded, processReferralDisputeChanged } from "@/lib/referral-events";
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

  if (event.type === "invoice.paid") {
    try {
      await processReferralInvoicePaid(stripe, createAdminClient(), event.data.object as Stripe.Invoice);
      return NextResponse.json({ received: true });
    } catch {
      return NextResponse.json({ error: "Referral invoice processing failed" }, { status: 500 });
    }
  }

  if (event.type === "charge.refunded") {
    try {
      await processReferralChargeRefunded(stripe, createAdminClient(), event.data.object as Stripe.Charge);
      return NextResponse.json({ received: true });
    } catch {
      return NextResponse.json({ error: "Referral refund processing failed" }, { status: 500 });
    }
  }

  if (event.type === "refund.created" || event.type === "refund.updated") {
    const refund = event.data.object as Stripe.Refund;
    const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
    if (chargeId) {
      try {
        await processReferralChargeRefunded(stripe, createAdminClient(), { id: chargeId } as Stripe.Charge);
      } catch {
        return NextResponse.json({ error: "Referral refund processing failed" }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "charge.dispute.created" || event.type === "charge.dispute.updated" || event.type === "charge.dispute.closed") {
    try {
      await processReferralDisputeChanged(stripe, createAdminClient(), event.data.object as Stripe.Dispute);
      return NextResponse.json({ received: true });
    } catch {
      return NextResponse.json({ error: "Referral dispute processing failed" }, { status: 500 });
    }
  }

  let reference;
  try {
    reference = getSubscriptionEventReference(event);
  } catch {
    return NextResponse.json({ error: "Invalid subscription event" }, { status: 400 });
  }
  if (!reference) return NextResponse.json({ received: true });

  const admin = createAdminClient();
  const leaseToken = crypto.randomUUID();
  let acquired: boolean;
  try {
    const { data, error } = await admin.rpc("acquire_stripe_subscription_sync_lease", {
      p_subscription_id: reference.subscriptionId,
      p_lease_token: leaseToken,
    });
    if (error) return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    acquired = data === true;
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
  if (!acquired) return NextResponse.json({ error: "Subscription sync is busy" }, { status: 503 });

  const response = await (async (): Promise<NextResponse> => {
    try {
      let currentSubscription;
      try {
        currentSubscription = await stripe.subscriptions.retrieve(reference.subscriptionId, {}, { timeout: 60_000 });
      } catch {
        return NextResponse.json({ error: "Could not refresh subscription" }, { status: 500 });
      }

      let sync;
      try {
        sync = buildSubscriptionSync(
          { ...event, data: { object: currentSubscription } },
          (productId, priceId, interval) => isStripePriceAllowedForProduct(productId, priceId, config, interval),
        );
      } catch {
        const { error } = await admin.rpc("invalidate_stripe_subscription_event", {
          p_event_id: event.id,
          p_event_created: event.created,
          p_subscription_id: reference.subscriptionId,
          p_lease_token: leaseToken,
        });
        return error
          ? NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
          : NextResponse.json({ received: true });
      }
      if (!sync) return NextResponse.json({ received: true });

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
        p_quantity: sync.quantity,
        p_price_id: sync.priceId,
        p_interval: sync.interval,
        p_lease_token: leaseToken,
        ...(sync.selectedBankIds ? { p_selected_bank_ids: sync.selectedBankIds } : {}),
      });
      return error
        ? NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
        : NextResponse.json({ received: true });
    } catch {
      return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
  })();
  try {
    const { data, error } = await admin.rpc("release_stripe_subscription_sync_lease", {
      p_subscription_id: reference.subscriptionId,
      p_lease_token: leaseToken,
    });
    if (error || data !== true) return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
  return response;
}
