import { randomUUID } from "node:crypto";
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
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: NO_STORE });
  if (!isStripeBillingEnabled()) return NextResponse.json({ error: "Billing is not available yet" }, { status: 503, headers: NO_STORE });
  const admin = createAdminClient();
  let sessionCreationAttempted = false;
  try {
    const config = getStripeConfig();
    const stripe = createStripeClient(config.secretKey);
    const access = await fetchAccessEntitlements(supabase as never, user.id);
    if (access.error) throw access.error;
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
    if (sub.status !== "active" || sub.customer !== customerId || sub.cancel_at_period_end !== false || sub.cancel_at != null || sub.pending_update != null || sub.schedule != null) return NextResponse.json({ error: "Subscription requires support review" }, { status: 409, headers: NO_STORE });
    const item = sub.items.data[0];
    const catalog = await admin.rpc("get_checkout_price_catalog", { p_price_id: target.priceId });
    if (catalog.error || !Array.isArray(catalog.data) || catalog.data.filter((row: { price_id?: unknown; product_id?: unknown; billing_interval?: unknown; active?: unknown; grandfathered?: unknown }) => row.price_id === target.priceId && row.product_id === target.productId && row.billing_interval === target.interval && (row.active === true || row.grandfathered === true)).length !== 1) return NextResponse.json({ error: "Subscription price requires support review" }, { status: 409, headers: NO_STORE });
    const eligibility = classifyLifetimeEligibility({ entitlements: access.rows as never[], lifetimeOwned: false, subscriptions: [sub], customerOwned: true, catalogMatches: [true] });
    if (eligibility.state !== "conversion_eligible") return NextResponse.json({ error: "Subscription requires support review" }, { status: 409, headers: NO_STORE });
    const periods = sub as typeof sub & { current_period_start: number; current_period_end: number };
    if (!Number.isSafeInteger(periods.current_period_start) || !Number.isSafeInteger(periods.current_period_end)) return NextResponse.json({ error: "Subscription period requires support review" }, { status: 409, headers: NO_STORE });
    const snapshot = { priceId: target.priceId, itemId: item.id, quantity: item.quantity, productId: target.productId, selectedBankIds: target.selectedBankIds ?? [], interval: target.interval, periodStart: new Date(periods.current_period_start * 1000).toISOString(), periodEnd: new Date(periods.current_period_end * 1000).toISOString(), status: sub.status, customerId };
    const intentId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const reservation = await admin.rpc("reserve_lifetime_conversion", { p_user_id: user.id, p_intent_id: intentId, p_customer_id: customerId, p_subscription_id: sub.id, p_snapshot: snapshot, p_expires_at: expiresAt.toISOString() });
    if (reservation.error) throw reservation.error;
    if (reservation.data !== true) return NextResponse.json({ error: "Another billing change is in progress" }, { status: 409, headers: NO_STORE });
    const current = await stripe.subscriptions.retrieve(sub.id, { expand: ["items.data.price"] });
    let currentTarget;
    try { currentTarget = readEditableCurrentPlan(current, config); } catch { return NextResponse.json({ error: "Subscription changed; reload billing" }, { status: 409, headers: NO_STORE }); }
    const currentPeriods = current as typeof current & { current_period_start: number; current_period_end: number };
    if (current.customer !== customerId || current.status !== "active" || JSON.stringify(currentTarget) !== JSON.stringify(target) || current.items.data[0].id !== item.id || currentPeriods.current_period_start !== periods.current_period_start || currentPeriods.current_period_end !== periods.current_period_end) return NextResponse.json({ error: "Subscription changed; reload billing" }, { status: 409, headers: NO_STORE });
    const metadata = { user_id: user.id, product_id: LIFETIME_OFFER.productId, purchase_type: "lifetime", billing_intent_id: intentId, conversion_intent_id: intentId };
    sessionCreationAttempted = true;
    const session = await stripe.checkout.sessions.create({ mode: "payment", customer: customerId, client_reference_id: user.id, line_items: [{ quantity: 1, price_data: { currency: LIFETIME_OFFER.currency, unit_amount: LIFETIME_OFFER.amountCents, product_data: { name: "Lifetime All Access", description: "One-time purchase; subscription renewals stop after confirmed payment.", metadata: { purchase_type: "lifetime", product_id: LIFETIME_OFFER.productId } } } }], success_url: `${config.siteUrl}/account?checkout=lifetime-pending`, cancel_url: `${config.siteUrl}/pricing?checkout=cancelled`, expires_at: Math.floor(expiresAt.getTime() / 1000), metadata, payment_intent_data: { metadata }, integration_identifier: `pastpaperprep-lifetime-${randomUUID().replaceAll("-", "").slice(0, 8)}` } as Parameters<typeof stripe.checkout.sessions.create>[0], { idempotencyKey: `pastpaperprep-lifetime-${intentId}`, timeout: 30_000 });
    if (!session.url) throw new Error("Stripe did not return checkout URL");
    const attached = await admin.rpc("attach_lifetime_conversion_session", { p_user_id: user.id, p_intent_id: intentId, p_session_id: session.id, p_expires_at: new Date(session.expires_at * 1000).toISOString() });
    if (attached.error) throw attached.error;
    if (attached.data !== true) throw new Error("Could not attach lifetime conversion session");
    return NextResponse.json({ url: session.url }, { headers: NO_STORE });
  } catch (error) {
    console.error("Lifetime conversion checkout failed", error instanceof Error ? { name: error.name, message: error.message } : { type: typeof error });
    return NextResponse.json({ error: "Lifetime checkout is temporarily unavailable" }, { status: 503, headers: NO_STORE });
  } finally {
    // A pending conversion lease is intentionally retained. Only a provider-verified expired session may release it.
    void sessionCreationAttempted;
  }
}
