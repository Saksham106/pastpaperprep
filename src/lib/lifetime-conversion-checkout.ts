import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { readEditableCurrentPlan } from "@/lib/account-plan-target";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { LIFETIME_OFFER } from "@/lib/lifetime-offer";
import { classifyLifetimeEligibility } from "@/lib/lifetime-eligibility";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };
const BILLABLE = new Set(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]);
const RECOVERY_LIMIT = 100;
const support = () => NextResponse.json({ error: "Billing requires support review" }, { status: 503, headers: NO_STORE });
const sameSnapshot = (a: Record<string, unknown>, b: Record<string, unknown>) => ["priceId", "itemId", "quantity", "productId", "selectedBankIds", "interval", "periodStart", "periodEnd", "status", "customerId"].every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));
function validLifetimeSession(session: Stripe.Checkout.Session, userId: string, customerId: string, intentId: string) {
  const lines = session.line_items;
  const line = lines?.data.length === 1 ? lines.data[0] : null;
  const product = line?.price?.product;
  const productMetadata = product && typeof product === "object" && !("deleted" in product) ? product.metadata : null;
  return session.customer === customerId && session.client_reference_id === userId && session.metadata?.user_id === userId && session.metadata?.conversion_intent_id === intentId && session.metadata?.billing_intent_id === intentId && session.metadata?.purchase_type === "lifetime" && session.metadata?.product_id === LIFETIME_OFFER.productId && session.mode === "payment" && lines?.has_more === false && line?.quantity === 1 && line.amount_subtotal === LIFETIME_OFFER.amountCents && line.currency === LIFETIME_OFFER.currency && line.price?.unit_amount === LIFETIME_OFFER.amountCents && line.price.currency === LIFETIME_OFFER.currency && !line.price.recurring && productMetadata?.purchase_type === "lifetime" && productMetadata.product_id === LIFETIME_OFFER.productId;
}
function checkoutParams(userId: string, customerId: string, intentId: string, expiresSeconds: number, siteUrl: string): Stripe.Checkout.SessionCreateParams {
 const metadata = { user_id: userId, product_id: LIFETIME_OFFER.productId, purchase_type: "lifetime", billing_intent_id: intentId, conversion_intent_id: intentId };
 return { mode: "payment", customer: customerId, client_reference_id: userId, line_items: [{ quantity: 1, price_data: { currency: LIFETIME_OFFER.currency, unit_amount: LIFETIME_OFFER.amountCents, product_data: { name: "Lifetime All Access", description: "One-time purchase; subscription renewals stop after confirmed payment.", metadata: { purchase_type: "lifetime", product_id: LIFETIME_OFFER.productId } } } }], success_url: `${siteUrl}/account?checkout=lifetime-pending`, cancel_url: `${siteUrl}/pricing?checkout=cancelled`, expires_at: expiresSeconds, metadata, payment_intent_data: { metadata }, integration_identifier: `pastpaperprep-lifetime-${intentId.replaceAll("-", "").slice(0, 8)}` } as Stripe.Checkout.SessionCreateParams;
}
export async function createLifetimeConversionCheckout() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: NO_STORE });
  if (!isStripeBillingEnabled()) return NextResponse.json({ error: "Billing is not available yet" }, { status: 503, headers: NO_STORE });
  const admin = createAdminClient();
  let sessionCreationAttempted = false;
  let reservedIntentId: string | null = null;
  try {
    const config = getStripeConfig();
    const stripe = createStripeClient(config.secretKey);
    const access = await fetchAccessEntitlements(supabase as never, user.id);
    if (access.error) throw access.error;
    const pendingResult = await admin.from("lifetime_conversions").select("*").eq("user_id", user.id).in("status", ["pending", "paid"]).maybeSingle();
    if (pendingResult.error) throw pendingResult.error;
    const pendingConversion = pendingResult.data as { intent_id: string; user_id: string; customer_id: string; subscription_id: string; subscription_snapshot: Record<string, unknown>; status: string; checkout_session_id: string | null; expires_at: string } | null;
    if (pendingConversion?.status === "paid") return support();
    const purchases = await admin.from("lifetime_purchases").select("status").eq("user_id", user.id).eq("status", "paid").limit(1);
    if (purchases.error) throw purchases.error;
    if (purchases.data.length) return NextResponse.json({ error: "Lifetime All Access is already owned" }, { status: 409, headers: NO_STORE });
    const mapping = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (mapping.error) throw mapping.error;
    const customerId = typeof mapping.data === "string" ? mapping.data : null;
    if (!customerId) return NextResponse.json({ error: "Lifetime conversion requires a verified Stripe customer" }, { status: 409, headers: NO_STORE });
    const listed = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    if (listed.has_more || listed.data.some((sub) => sub.customer !== customerId || (sub.metadata.user_id !== undefined && sub.metadata.user_id !== user.id))) return NextResponse.json({ error: "Billing requires support review" }, { status: 409, headers: NO_STORE });
    const subscriptions = listed.data.filter((sub) => BILLABLE.has(sub.status));
    if (subscriptions.length !== 1) return NextResponse.json({ error: "No single convertible subscription was found" }, { status: 409, headers: NO_STORE });
    const sub = subscriptions[0];
    let target;
    try { target = readEditableCurrentPlan(sub, config); } catch { return NextResponse.json({ error: "Subscription requires support review" }, { status: 409, headers: NO_STORE }); }
    if (sub.metadata.user_id !== user.id || sub.status !== "active" || sub.customer !== customerId || sub.cancel_at_period_end !== false || sub.cancel_at != null || sub.pending_update != null || sub.schedule != null) return NextResponse.json({ error: "Subscription requires support review" }, { status: 409, headers: NO_STORE });
    const item = sub.items.data[0];
    const catalog = await admin.rpc("get_checkout_price_catalog", { p_price_id: target.priceId });
    if (catalog.error || !Array.isArray(catalog.data) || catalog.data.filter((row: { price_id?: unknown; product_id?: unknown; billing_interval?: unknown; active?: unknown; grandfathered?: unknown }) => row.price_id === target.priceId && row.product_id === target.productId && row.billing_interval === target.interval && (row.active === true || row.grandfathered === true)).length !== 1) return NextResponse.json({ error: "Subscription price requires support review" }, { status: 409, headers: NO_STORE });
    const eligibility = classifyLifetimeEligibility({ entitlements: access.rows as never[], lifetimeOwned: false, subscriptions: [sub], customerOwned: true, catalogMatches: [true] });
    if (eligibility.state !== "conversion_eligible") return NextResponse.json({ error: "Subscription requires support review" }, { status: 409, headers: NO_STORE });
    const periods = { current_period_start: item.current_period_start, current_period_end: item.current_period_end };
    if (!Number.isSafeInteger(periods.current_period_start) || !Number.isSafeInteger(periods.current_period_end)) return NextResponse.json({ error: "Subscription period requires support review" }, { status: 409, headers: NO_STORE });
    const snapshot = { priceId: target.priceId, itemId: item.id, quantity: item.quantity, productId: target.productId, selectedBankIds: target.selectedBankIds ?? [], interval: target.interval, periodStart: new Date(periods.current_period_start * 1000).toISOString(), periodEnd: new Date(periods.current_period_end * 1000).toISOString(), status: sub.status, customerId };
    if (pendingConversion) {
      const stored = pendingConversion.subscription_snapshot as Record<string, unknown>;
      if (!pendingConversion.intent_id || pendingConversion.customer_id !== customerId || pendingConversion.subscription_id !== sub.id || !sameSnapshot(stored, snapshot)) return support();
      let recoverySessionId = pendingConversion.checkout_session_id;
      if (!recoverySessionId) {
        let after: string | undefined;
        for (let pageNumber = 0; pageNumber < 5; pageNumber++) {
          const page = await stripe.checkout.sessions.list({ customer: customerId, limit: RECOVERY_LIMIT, ...(after ? { starting_after: after } : {}) });
          const matching = page.data.filter((entry) => entry.metadata?.conversion_intent_id === pendingConversion.intent_id);
          if (matching.length > 1) return support();
          if (matching.length === 1) { recoverySessionId = matching[0].id; break; }
          if (!page.has_more) break;
          after = page.data.at(-1)?.id;
          if (!after || pageNumber === 4) return support();
        }
        if (!recoverySessionId) {
          const originalExpires = Math.floor(Date.parse(pendingConversion.expires_at) / 1000);
          if (!Number.isSafeInteger(originalExpires) || originalExpires < Math.floor(Date.now() / 1000) + 1800) return support();
          sessionCreationAttempted = true;
          const recovered = await stripe.checkout.sessions.create(checkoutParams(user.id, customerId, pendingConversion.intent_id, originalExpires, config.siteUrl), { idempotencyKey: `pastpaperprep-lifetime-${pendingConversion.intent_id}`, timeout: 30_000 });
          recoverySessionId = recovered.id;
        }
      }
      if (recoverySessionId) {
        const existing = await stripe.checkout.sessions.retrieve(recoverySessionId, { expand: ["line_items.data.price.product"] });
        if (!validLifetimeSession(existing, user.id, customerId, pendingConversion.intent_id)) return support();
        if (existing.payment_status === "paid" || existing.status === "complete") return support();
        if (existing.status === "open" && existing.url && existing.expires_at > Math.floor(Date.now() / 1000) + 60) {
          const attached = await admin.rpc("attach_lifetime_conversion_session", { p_user_id: user.id, p_intent_id: pendingConversion.intent_id, p_session_id: existing.id, p_expires_at: new Date(existing.expires_at * 1000).toISOString() });
          if (attached.error || attached.data !== true) return support();
          return NextResponse.json({ url: existing.url }, { headers: NO_STORE });
        }
        if (existing.status !== "expired") return support();
        const expired = await admin.rpc("expire_lifetime_conversion", { p_session_id: existing.id });
        if (expired.error || expired.data !== true) return support();
        const released = await admin.rpc("release_billing_checkout", { p_user_id: user.id, p_intent_id: pendingConversion.intent_id });
        if (released.error) throw released.error;
      } else return support();
    }
    const intentId = randomUUID();
    const expiresAt = new Date(Date.now() + 31 * 60 * 1000);
    const reservation = await admin.rpc("reserve_lifetime_conversion", { p_user_id: user.id, p_intent_id: intentId, p_customer_id: customerId, p_subscription_id: sub.id, p_snapshot: snapshot, p_expires_at: expiresAt.toISOString() });
    if (reservation.error) throw reservation.error;
    if (reservation.data !== true) return NextResponse.json({ error: "Another billing change is in progress" }, { status: 409, headers: NO_STORE });
    reservedIntentId = intentId;
    const current = await stripe.subscriptions.retrieve(sub.id, { expand: ["items.data.price"] });
    let currentTarget;
    try { currentTarget = readEditableCurrentPlan(current, config); } catch { return NextResponse.json({ error: "Subscription changed; reload billing" }, { status: 409, headers: NO_STORE }); }
    const currentPeriods = { current_period_start: current.items.data[0]?.current_period_start, current_period_end: current.items.data[0]?.current_period_end };
    if (current.customer !== customerId || current.status !== "active" || JSON.stringify(currentTarget) !== JSON.stringify(target) || current.items.data[0].id !== item.id || currentPeriods.current_period_start !== periods.current_period_start || currentPeriods.current_period_end !== periods.current_period_end) return NextResponse.json({ error: "Subscription changed; reload billing" }, { status: 409, headers: NO_STORE });
    sessionCreationAttempted = true;
    const session = await stripe.checkout.sessions.create(checkoutParams(user.id, customerId, intentId, Math.floor(expiresAt.getTime() / 1000), config.siteUrl), { idempotencyKey: `pastpaperprep-lifetime-${intentId}`, timeout: 30_000 });
    if (!session.url) throw new Error("Stripe did not return checkout URL");
    const attached = await admin.rpc("attach_lifetime_conversion_session", { p_user_id: user.id, p_intent_id: intentId, p_session_id: session.id, p_expires_at: new Date(session.expires_at * 1000).toISOString() });
    if (attached.error) throw attached.error;
    if (attached.data !== true) throw new Error("Could not attach lifetime conversion session");
    return NextResponse.json({ url: session.url }, { headers: NO_STORE });
  } catch (error) {
    console.error("Lifetime conversion checkout failed", error instanceof Error ? { name: error.name, message: error.message } : { type: typeof error });
    return NextResponse.json({ error: "Lifetime checkout is temporarily unavailable" }, { status: 503, headers: NO_STORE });
  } finally {
    if (reservedIntentId && !sessionCreationAttempted) {
      const aborted = await admin.rpc("abort_lifetime_conversion", { p_user_id: user.id, p_intent_id: reservedIntentId });
      if (aborted.error) console.error("Could not abort lifetime conversion reservation", { message: aborted.error.message });
    }
  }
}