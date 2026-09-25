import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { processReferralInvoicePaid, processReferralChargeRefunded, processReferralDisputeChanged } from "@/lib/referral-events";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig } from "@/lib/stripe-config";
import { buildSubscriptionSync, getSubscriptionEventReference } from "@/lib/stripe-subscriptions";
import { verifyScheduledRenewalPayment } from "@/lib/account-schedule-invoice";
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

  let invoicePaidReference: string | null = null;
  let invoicePaidId: string | null = null;
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    try {
      await processReferralInvoicePaid(stripe, createAdminClient(), invoice);
    } catch {
      return NextResponse.json({ error: "Referral invoice processing failed" }, { status: 500 });
    }
    // Most paid invoices have nothing to do with the app's scheduled editor.
    // Only its exact scheduled renewal can also reconcile bank entitlements.
    const subscriptionId = invoice.parent?.type === "subscription_details" ? invoice.parent.subscription_details?.subscription : null;
    if (invoice.status !== "paid" || invoice.billing_reason !== "subscription_cycle" || typeof subscriptionId !== "string") {
      return NextResponse.json({ received: true });
    }
    try {
      const current = await stripe.subscriptions.retrieve(subscriptionId, {}, { timeout: 60_000 });
      const latestInvoiceId = typeof current.latest_invoice === "string" ? current.latest_invoice : current.latest_invoice?.id;
      if (latestInvoiceId !== invoice.id) return NextResponse.json({ received: true });
      const scheduleId = typeof current.schedule === "string" ? current.schedule : current.schedule?.id;
      if (!scheduleId) return NextResponse.json({ received: true });
      const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId, {}, { timeout: 60_000 });
      if (schedule.metadata?.owner !== "pastpaperprep") return NextResponse.json({ received: true });
      invoicePaidReference = subscriptionId;
      invoicePaidId = invoice.id;
    } catch {
      return NextResponse.json({ error: "Could not verify scheduled invoice" }, { status: 500 });
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
    reference = invoicePaidReference ? { subscriptionId: invoicePaidReference } : getSubscriptionEventReference(event);
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

      if (invoicePaidId) {
        const latestInvoiceId = typeof currentSubscription.latest_invoice === "string" ? currentSubscription.latest_invoice : currentSubscription.latest_invoice?.id;
        if (latestInvoiceId !== invoicePaidId) return NextResponse.json({ received: true });
      }
      let paidSecondPhaseScheduleId: string | null = null;
      try {
        const phase = await verifyScheduledRenewalPayment(stripe, currentSubscription as Stripe.Subscription);
        if (phase === "paid-phase-two") paidSecondPhaseScheduleId = typeof currentSubscription.schedule === "string" ? currentSubscription.schedule : currentSubscription.schedule?.id ?? null;
      } catch {
        // A scheduled phase can change bank metadata before its invoice is paid.
        // Never invalidate or grant from an unverified renewal; retry after payment.
        return NextResponse.json({ error: "Scheduled renewal payment is pending or unverifiable" }, { status: 503 });
      }

      let sync;
      try {
        const subscription = currentSubscription as Stripe.Subscription;
        const metadataProductId = subscription.metadata?.product_id;
        const items = subscription.items.data;
        const item = items.length === 1 ? items[0] : null;
        const priceId = item?.price?.id;
        const interval = item?.price?.recurring?.interval === "month" ? "monthly"
          : item?.price?.recurring?.interval === "year" ? "annual" : null;
        if (typeof metadataProductId !== "string" || typeof priceId !== "string" || !interval) {
          throw new Error("Stripe price identity is ambiguous");
        }
        const { data: catalogRows, error: catalogError } = await admin.rpc("get_checkout_price_catalog", { p_price_id: priceId });
        if (catalogError) return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
        const matchingCatalogRows = Array.isArray(catalogRows)
          ? catalogRows.filter((row) => row.price_id === priceId && row.product_id === metadataProductId && row.billing_interval === interval && (row.active === true || row.grandfathered === true))
          : [];
        if (matchingCatalogRows.length !== 1) {
          throw new Error("Stripe price does not match the catalog");
        }
        sync = buildSubscriptionSync(
          { ...event, type: invoicePaidReference ? "customer.subscription.updated" : event.type, data: { object: currentSubscription } },
          (productId, catalogPriceId, catalogInterval) => productId === metadataProductId && catalogPriceId === priceId && catalogInterval === interval,
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

      const { data: syncResult, error } = await admin.rpc("apply_stripe_subscription_event", {
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
      if (error) return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
      if (paidSecondPhaseScheduleId) {
        if (syncResult !== "applied" && syncResult !== "duplicate") return NextResponse.json({ error: "Scheduled renewal sync is unresolved" }, { status: 503 });
        const before = currentSubscription as Stripe.Subscription;
        const beforeItem = before.items.data[0];
        try {
          await stripe.subscriptionSchedules.release(paidSecondPhaseScheduleId, {}, {
            idempotencyKey: `pastpaperprep-paid-schedule-release-${paidSecondPhaseScheduleId}`, timeout: 30_000,
          });
          const [released, after] = await Promise.all([
            stripe.subscriptionSchedules.retrieve(paidSecondPhaseScheduleId, {}, { timeout: 30_000 }),
            stripe.subscriptions.retrieve(before.id, {}, { timeout: 30_000 }),
          ]);
          const afterItem = after.items.data.length === 1 ? after.items.data[0] : null;
          const beforePrice = typeof beforeItem.price === "string" ? beforeItem.price : beforeItem.price.id;
          const afterPrice = afterItem ? typeof afterItem.price === "string" ? afterItem.price : afterItem.price.id : null;
          if (released.id !== paidSecondPhaseScheduleId || released.status !== "released" || released.subscription !== null || released.current_phase !== null ||
            after.id !== before.id || after.schedule !== null || after.status !== "active" || after.customer !== before.customer ||
            !afterItem || afterItem.id !== beforeItem.id || afterPrice !== beforePrice || afterItem.quantity !== beforeItem.quantity ||
            afterItem.current_period_start !== beforeItem.current_period_start || afterItem.current_period_end !== beforeItem.current_period_end ||
            JSON.stringify(Object.entries(after.metadata).sort()) !== JSON.stringify(Object.entries(before.metadata).sort())) throw new Error("Paid schedule release readback mismatch");
        } catch {
          return NextResponse.json({ error: "Paid schedule release is pending verification" }, { status: 503 });
        }
      }
      return NextResponse.json({ received: true });
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
