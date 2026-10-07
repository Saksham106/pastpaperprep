import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { processReferralInvoicePaid, processReferralChargeRefunded, processReferralDisputeChanged } from "@/lib/referral-events";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig } from "@/lib/stripe-config";
import { buildSubscriptionSync, getSubscriptionEventReference } from "@/lib/stripe-subscriptions";
import { verifyScheduledRenewalPayment } from "@/lib/account-schedule-invoice";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureConversionOutcome } from "@/lib/server-conversion-analytics";
import { lifetimeCheckoutMetadataIsValid, LIFETIME_OFFER } from "@/lib/lifetime-offer";

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

  const admin = createAdminClient();
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.purchase_type !== "lifetime") return NextResponse.json({ received: true });
    if (!lifetimeCheckoutMetadataIsValid(session.metadata, session.client_reference_id ?? "") || session.mode !== "payment") {
      return NextResponse.json({ error: "Invalid lifetime checkout metadata" }, { status: 400 });
    }
    // `completed` also fires for unpaid asynchronous methods. Only fulfillment
    // follows Stripe's paid status; async success is independently supported.
    if (session.payment_status !== "paid") return NextResponse.json({ received: true });
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2, expand: ["data.price.product"] });
      const lifetimeItems = lineItems.data;
      const lifetimeProduct = lifetimeItems.length === 1 ? lifetimeItems[0]?.price?.product : null;
      const productMetadata = lifetimeProduct && typeof lifetimeProduct === "object" && !("deleted" in lifetimeProduct) ? lifetimeProduct.metadata : null;
      const validLineItem = !lineItems.has_more && lifetimeItems.length === 1 && lifetimeItems[0]?.quantity === 1 &&
        lifetimeItems[0]?.amount_subtotal === LIFETIME_OFFER.amountCents && lifetimeItems[0]?.currency === LIFETIME_OFFER.currency &&
        lifetimeItems[0]?.price?.unit_amount === LIFETIME_OFFER.amountCents && lifetimeItems[0]?.price?.currency === LIFETIME_OFFER.currency &&
        !lifetimeItems[0]?.price?.recurring && productMetadata?.purchase_type === "lifetime" && productMetadata?.product_id === LIFETIME_OFFER.productId;
      if (!validLineItem) return NextResponse.json({ error: "Lifetime line item verification failed" }, { status: 400 });
    } catch {
      return NextResponse.json({ error: "Lifetime line item verification failed" }, { status: 500 });
    }
    const userId = session.client_reference_id!;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!customerId || !paymentIntentId || session.amount_total !== LIFETIME_OFFER.amountCents || session.currency !== LIFETIME_OFFER.currency) {
      return NextResponse.json({ error: "Lifetime payment verification failed" }, { status: 400 });
    }
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {}, { timeout: 10_000 });
      const intentCustomerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer?.id;
      if (paymentIntent.status !== "succeeded" || intentCustomerId !== customerId ||
        paymentIntent.amount_received !== LIFETIME_OFFER.amountCents || paymentIntent.currency !== LIFETIME_OFFER.currency ||
        paymentIntent.metadata?.user_id !== session.metadata.user_id ||
        paymentIntent.metadata?.product_id !== session.metadata.product_id ||
        paymentIntent.metadata?.purchase_type !== session.metadata.purchase_type ||
        typeof session.metadata.billing_intent_id !== "string" || !session.metadata.billing_intent_id ||
        paymentIntent.metadata?.billing_intent_id !== session.metadata.billing_intent_id) {
        return NextResponse.json({ error: "Lifetime payment verification failed" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Lifetime payment verification failed" }, { status: 500 });
    }
    const { data: mappedCustomer, error: mappingError } = await admin.rpc("get_stripe_customer_id", { p_user_id: userId });
    if (mappingError || mappedCustomer !== customerId) return NextResponse.json({ error: "Lifetime customer ownership could not be verified" }, { status: 500 });
    const { error } = await admin.rpc("fulfill_lifetime_purchase", {
      p_user_id: userId, p_session_id: session.id, p_payment_intent_id: paymentIntentId,
      p_amount_cents: session.amount_total, p_currency: session.currency,
      p_purchased_at: new Date((session.created || event.created) * 1000).toISOString(),
    });
    if (error) return NextResponse.json({ error: "Lifetime purchase fulfillment failed" }, { status: 500 });
    return NextResponse.json({ received: true });
  }
  if (event.type === "charge.refunded" || event.type === "charge.dispute.created" || event.type === "charge.dispute.updated" || event.type === "charge.dispute.closed") {
    const charge = event.data.object as Stripe.Charge | Stripe.Dispute;
    const isDispute = event.type.startsWith("charge.dispute.");
    const rawPaymentIntent = isDispute ? (charge as Stripe.Dispute).payment_intent : (charge as Stripe.Charge).payment_intent;
    const pi = typeof rawPaymentIntent === "string" ? rawPaymentIntent
      : rawPaymentIntent && typeof rawPaymentIntent === "object" ? rawPaymentIntent.id : null;
    if (pi) {
      const fullRefund = !isDispute && (charge as Stripe.Charge).amount_refunded >= (charge as Stripe.Charge).amount;
      const disputed = isDispute && event.type !== "charge.dispute.closed" || isDispute && (charge as Stripe.Dispute).status !== "won";
      if (disputed || fullRefund) {
        const { error } = await admin.rpc("revoke_lifetime_purchase", { p_payment_intent_id: pi, p_status: disputed ? "disputed" : "refunded" });
        if (error) return NextResponse.json({ error: "Lifetime access revocation failed" }, { status: 500 });
      } else if (isDispute && event.type === "charge.dispute.closed" && (charge as Stripe.Dispute).status === "won") {
        const dispute = charge as Stripe.Dispute;
        const rawCharge = dispute.charge;
        const chargeId = typeof rawCharge === "string" ? rawCharge : rawCharge?.id;
        if (!chargeId) return NextResponse.json({ error: "Lifetime dispute charge could not be verified" }, { status: 400 });
        try {
          const settledCharge = await stripe.charges.retrieve(chargeId, {}, { timeout: 10_000 });
          if (settledCharge.amount_refunded < settledCharge.amount) {
            const { error } = await admin.rpc("restore_lifetime_purchase", { p_payment_intent_id: pi });
            if (error) return NextResponse.json({ error: "Lifetime access restoration failed" }, { status: 500 });
          }
        } catch {
          return NextResponse.json({ error: "Lifetime dispute resolution could not be verified" }, { status: 500 });
        }
      }
    }
    // Existing referral refund/dispute bookkeeping still runs below for its own records.
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
    // Payment outcomes are independent of entitlement reconciliation. Only capture a
    // positive, signature-verified paid invoice after read-only ownership/catalog checks.
    const subscriptionId = invoice.parent?.type === "subscription_details" ? invoice.parent.subscription_details?.subscription : null;
    if (invoice.status === "paid" && Number.isSafeInteger(invoice.amount_paid) && invoice.amount_paid > 0 &&
      (invoice.billing_reason === "subscription_create" || invoice.billing_reason === "subscription_cycle") && typeof subscriptionId === "string") {
      try {
        const current = await stripe.subscriptions.retrieve(subscriptionId, {}, { timeout: 10_000 });
        const latestInvoiceId = typeof current.latest_invoice === "string" ? current.latest_invoice : current.latest_invoice?.id;
        const metadataUserId = current.metadata?.user_id;
        const customerId = typeof current.customer === "string" ? current.customer : current.customer?.id;
        const invoiceCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        const validUserId = typeof metadataUserId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(metadataUserId);
        const metadataProductId = current.metadata?.product_id;
        const items = current.items.data;
        const item = items.length === 1 ? items[0] : null;
        const priceId = item?.price?.id;
        const interval = item?.price?.recurring?.interval === "month" ? "monthly"
          : item?.price?.recurring?.interval === "year" ? "annual" : null;
        if (latestInvoiceId === invoice.id && typeof metadataProductId === "string" && typeof priceId === "string" && interval && validUserId && customerId === invoiceCustomerId) {
          const { data: rows, error } = await createAdminClient().rpc("get_checkout_price_catalog", { p_price_id: priceId });
          const matches = !error && Array.isArray(rows) ? rows.filter((row) => row.price_id === priceId && row.product_id === metadataProductId && row.billing_interval === interval && (row.active === true || row.grandfathered === true)) : [];
          const paidAt = invoice.status_transitions?.paid_at ?? invoice.created;
          const { data: mappedCustomer, error: mappingError } = await createAdminClient().rpc("get_stripe_customer_id", { p_user_id: metadataUserId });
          if (matches.length === 1 && !mappingError && mappedCustomer === customerId && Number.isSafeInteger(paidAt) && paidAt > 0) await captureConversionOutcome({
            outcome: invoice.billing_reason === "subscription_create" ? "payment_initial_paid" : "payment_renewal_paid",
            eventKey: `stripe:invoice:${invoice.id}`,
            userId: metadataUserId,
            occurredAt: new Date(paidAt * 1000).toISOString(),
            product: metadataProductId,
            interval,
          });
        }
      } catch {
        // Lookup/analytics failure must never affect invoice or entitlement processing.
      }
    }
    // Most paid invoices have nothing to do with the app's scheduled editor.
    // Only its exact scheduled renewal can also reconcile bank entitlements.
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
