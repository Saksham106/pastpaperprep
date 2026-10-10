import { randomUUID } from "node:crypto";
import { createLifetimeConversionCheckout } from "@/lib/lifetime-conversion-checkout";
import { NextResponse } from "next/server";
import { getEntitlementBanks } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { hasBankAccess } from "@/lib/access";
import { LIFETIME_OFFER } from "@/lib/lifetime-offer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";

import { withFailureReporting } from "@/lib/route-failure-reporting";
export const runtime = "nodejs";

async function handlePOST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isStripeBillingEnabled()) return NextResponse.json({ error: "Billing is not available yet" }, { status: 503 });
  const access = await fetchAccessEntitlements(supabase as never, user.id);
  if (access.error) return NextResponse.json({ error: "Could not verify account access" }, { status: 503 });
  if (getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, access.rows as never[]))) {
    return createLifetimeConversionCheckout();
  }
  const admin = createAdminClient();
  const intentId = randomUUID();
  let reserved = false;
  let sessionAttempted = false;
  try {
    const { data: reservation, error: reserveError } = await admin.rpc("reserve_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
    if (reserveError) throw reserveError;
    if (reservation !== true) return NextResponse.json({ error: "Another checkout is already in progress" }, { status: 409 });
    reserved = true;
    const { data: eligible, error: confirmError } = await admin.rpc("confirm_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
    if (confirmError) throw confirmError;
    if (eligible !== true) return NextResponse.json({ error: "Account access changed; reload before checkout" }, { status: 409 });
    const config = getStripeConfig();
    const stripe = createStripeClient(config.secretKey);
    const { data: mapped, error: mapError } = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (mapError) throw mapError;
    let customerId = typeof mapped === "string" ? mapped : null;
    if (!customerId) {
      const found = await stripe.customers.search({ query: `metadata['user_id']:'${user.id}'`, limit: 2 });
      if (found.data.length > 1) throw new Error("Multiple Stripe customers mapped to account");
      customerId = found.data[0]?.id ?? null;
      if (!customerId) customerId = (await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } }, { idempotencyKey: `pastpaperprep-customer-${user.id}` })).id;
      const { data: claimed, error } = await admin.rpc("claim_stripe_customer", { p_user_id: user.id, p_customer_id: customerId });
      if (error || claimed !== customerId) throw error ?? new Error("Could not claim Stripe customer");
    }
    let after: string | undefined;
    do {
      const page = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100, ...(after ? { starting_after: after } : {}) });
      if (page.data.some((sub) => sub.status !== "canceled" && sub.status !== "incomplete_expired")) {
        return NextResponse.json({ error: "Lifetime checkout is unavailable while a subscription is billed to this account. Contact support to review your billing first." }, { status: 409 });
      }
      after = page.has_more ? page.data.at(-1)?.id : undefined;
      if (page.has_more && !after) throw new Error("Subscription pagination did not advance");
    } while (after);
    let openAfter: string | undefined;
    do {
      const openPage = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100, ...(openAfter ? { starting_after: openAfter } : {}) });
      for (const openSession of openPage.data) {
        if (openSession.mode !== "payment" || openSession.metadata?.purchase_type !== "lifetime" ||
          openSession.metadata?.product_id !== LIFETIME_OFFER.productId || openSession.metadata?.user_id !== user.id ||
          openSession.client_reference_id !== user.id || openSession.customer !== customerId) continue;
        const lineItems = await stripe.checkout.sessions.listLineItems(openSession.id, { limit: 2, expand: ["data.price.product"] });
        const line = lineItems.data.length === 1 ? lineItems.data[0] : null;
        const product = line?.price?.product;
        const productMetadata = product && typeof product === "object" && !("deleted" in product) ? product.metadata : null;
        const matchesOffer = !lineItems.has_more && line?.quantity === 1 && line.amount_subtotal === LIFETIME_OFFER.amountCents &&
          line.currency === LIFETIME_OFFER.currency && line.price?.unit_amount === LIFETIME_OFFER.amountCents &&
          line.price.currency === LIFETIME_OFFER.currency && !line.price.recurring &&
          productMetadata?.purchase_type === "lifetime" && productMetadata?.product_id === LIFETIME_OFFER.productId;
        if (matchesOffer && openSession.url && openSession.expires_at > Math.floor(Date.now() / 1000) + 60) {
          return NextResponse.json({ url: openSession.url });
        }
        await stripe.checkout.sessions.expire(openSession.id, {}, { idempotencyKey: `pastpaperprep-expire-lifetime-${openSession.id}` });
      }
      openAfter = openPage.has_more ? openPage.data.at(-1)?.id : undefined;
      if (openPage.has_more && !openAfter) throw new Error("Open Checkout pagination did not advance");
    } while (openAfter);
    sessionAttempted = true;
    const metadata = { user_id: user.id, product_id: LIFETIME_OFFER.productId, purchase_type: "lifetime", billing_intent_id: intentId };
    const session = await stripe.checkout.sessions.create({
      mode: "payment", customer: customerId, client_reference_id: user.id,
      line_items: [{ quantity: 1, price_data: { currency: LIFETIME_OFFER.currency, unit_amount: LIFETIME_OFFER.amountCents, product_data: { name: "Lifetime All Access", description: "All current and future question banks. One-time payment; no subscription or renewals.", metadata: { purchase_type: "lifetime", product_id: LIFETIME_OFFER.productId } } } }],
      success_url: `${config.siteUrl}/account?checkout=lifetime-pending`, cancel_url: `${config.siteUrl}/pricing?checkout=cancelled`,
      metadata, payment_intent_data: { metadata },
      integration_identifier: `pastpaperprep-lifetime-${randomUUID().replaceAll("-", "").slice(0, 8)}`,
    } as Parameters<typeof stripe.checkout.sessions.create>[0], { idempotencyKey: `pastpaperprep-lifetime-${intentId}`, timeout: 30_000 });
    if (!session.url) throw new Error("Stripe did not return checkout URL");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Lifetime Checkout failed", error instanceof Error ? { name: error.name, message: error.message } : { type: typeof error });
    return NextResponse.json({ error: "Lifetime checkout is temporarily unavailable" }, { status: 503 });
  } finally {
    if (reserved && !sessionAttempted) await admin.rpc("release_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
  }
}

export const POST = withFailureReporting("/api/billing/lifetime/checkout", handlePOST);
