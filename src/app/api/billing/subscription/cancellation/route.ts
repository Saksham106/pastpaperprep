import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import {
  acceptedDiscountRecently, chooseRetentionOffer, isCancelReason, isRetentionHoldout, planShapeFromMetadata,
  RETENTION_ACCEPTED_METADATA_KEY, RETENTION_DISCOUNT_PERCENT, STRIPE_CANCEL_FEEDBACK, type CancelReason,
} from "@/lib/retention-offer";

export const runtime = "nodejs";
const HEADERS = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS });
class Conflict extends Error {}
type Intent = "cancel" | "undo" | "offer" | "accept_discount";
const INTENTS = new Set<unknown>(["cancel", "undo", "offer", "accept_discount"]);
const COUPON_ID = /^[A-Za-z0-9_-]{1,64}$/;
type Admin = ReturnType<typeof createAdminClient>;

/** Reads every subscription and returns the single active one, or throws Conflict. Shared by all intents. */
async function loadActiveSubscription(stripe: Stripe, customerId: string, userId: string) {
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
  if (subscriptions.has_more) throw new Conflict("Subscription list exceeds safe limit");
  if (subscriptions.data.some((s) => s.customer !== customerId || s.metadata?.user_id !== userId)) throw new Conflict("Stripe billing owner mismatch");
  const active = subscriptions.data.filter((s) => s.status === "active");
  if (active.length !== 1) throw new Conflict("Exactly one active subscription is required");
  const sub = active[0];
  if (sub.metadata?.user_id !== userId || sub.customer !== customerId || sub.pending_update || sub.schedule) throw new Conflict("Subscription is not eligible for cancellation");
  if (sub.items.data.length !== 1) throw new Conflict("Expected exactly one subscription item");
  const periodEnd = sub.items.data[0].current_period_end;
  if (!Number.isSafeInteger(periodEnd) || periodEnd <= Math.floor(Date.now() / 1000)) throw new Conflict("Subscription period end is invalid");
  if (sub.cancel_at != null && (!sub.cancel_at_period_end || sub.cancel_at !== periodEnd)) throw new Conflict("Subscription has a separate cancellation date");
  return { sub, periodEnd, all: subscriptions.data };
}

async function assertNoOpenBilling(stripe: Stripe, customerId: string) {
  const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
  if (sessions.has_more) throw new Conflict("Open Checkout session list exceeds safe limit");
  if (sessions.data.length) throw new Conflict("An open Checkout session must be resolved first");
  const invoices = await stripe.invoices.list({ customer: customerId, status: "open", limit: 100 });
  if (invoices.has_more) throw new Conflict("Open invoice list exceeds safe limit");
  if (invoices.data.some((invoice) => invoice.customer !== customerId || invoice.status === "open")) throw new Conflict("An open invoice must be resolved first");
}

function monthlyOrAnnual(sub: Stripe.Subscription): "monthly" | "annual" | null {
  const recurring = sub.items.data[0]?.price?.recurring;
  if (recurring?.interval === "month" && recurring.interval_count === 1) return "monthly";
  if (recurring?.interval === "year" && recurring.interval_count === 1) return "annual";
  return null;
}

/** The retention discount needs a monthly plan, no other discount, no recent acceptance and the exact pre-approved coupon. */
async function discountEligible(stripe: Stripe, customerId: string, sub: Stripe.Subscription, all: Stripe.Subscription[]): Promise<{ eligible: false } | { eligible: true; couponId: string }> {
  const couponId = process.env.STRIPE_RETENTION_COUPON_ID?.trim();
  if (!couponId || !COUPON_ID.test(couponId)) return { eligible: false };
  if (monthlyOrAnnual(sub) !== "monthly" || sub.cancel_at_period_end || sub.cancel_at != null) return { eligible: false };
  if (!Array.isArray(sub.discounts) || sub.discounts.length) return { eligible: false };
  if (acceptedDiscountRecently(all, new Date())) return { eligible: false };
  const [coupon, customer] = await Promise.all([stripe.coupons.retrieve(couponId), stripe.customers.retrieve(customerId)]);
  if (!coupon.valid || coupon.percent_off !== RETENTION_DISCOUNT_PERCENT || coupon.amount_off !== null || coupon.duration !== "once") return { eligible: false };
  // A customer-level discount would be replaced on the next invoice; never swap a student's existing discount.
  if ("deleted" in customer || customer.discount) return { eligible: false };
  return { eligible: true, couponId };
}

/** Latest marked question or saved worksheet. A failed read is "unknown", which never counts as inactive. */
async function lastStudyActivity(admin: Admin, userId: string): Promise<Date | null> {
  const latest = async (table: "attempts" | "saved_worksheets") => {
    try {
      const { data, error } = await admin.from(table).select("updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (error || !data || typeof data.updated_at !== "string") return { known: !error, at: null };
      const at = Date.parse(data.updated_at);
      return { known: true, at: Number.isFinite(at) ? at : null };
    } catch { return { known: false, at: null }; }
  };
  const results = await Promise.all([latest("attempts"), latest("saved_worksheets")]);
  if (results.some((result) => !result.known)) return null;
  const times = results.flatMap((result) => result.at === null ? [] : [result.at]);
  return times.length ? new Date(Math.max(...times)) : null;
}

async function handlePOST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origin not allowed" }, 403);
  if (process.env.STRIPE_PLAN_EDITOR_ENABLED !== "true") return json({ error: "Subscription cancellation is unavailable" }, 404);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Authentication required" }, 401);
  if (!isStripeBillingEnabled()) return json({ error: "Billing is not available" }, 503);
  let intent: Intent;
  let reason: CancelReason | null = null;
  try {
    const body = await request.json() as { intent?: unknown; reason?: unknown };
    if (!body || typeof body !== "object" || Array.isArray(body) || !INTENTS.has(body.intent)) return json({ error: "Invalid cancellation intent" }, 400);
    intent = body.intent as Intent;
    if (body.reason !== undefined && body.reason !== null) {
      if ((intent !== "cancel" && intent !== "offer") || !isCancelReason(body.reason)) return json({ error: "Invalid cancellation reason" }, 400);
      reason = body.reason;
    }
  } catch { return json({ error: "Invalid JSON" }, 400); }

  const admin = createAdminClient();
  if (intent === "offer") return offer(admin, user.id, reason);

  const intentId = randomUUID();
  let held = false;
  let providerAttempted = false;
  try {
    const { data: reserved, error: reserveError } = await admin.rpc("reserve_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
    if (reserveError) throw reserveError;
    if (reserved !== true) throw new Conflict("Another billing operation is in progress");
    held = true;
    const { data: customerId, error: customerError } = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (customerError) throw customerError;
    if (typeof customerId !== "string" || !customerId) throw new Conflict("No billing account found");
    const stripe = createStripeClient(getStripeConfig().secretKey);
    const { sub, periodEnd, all } = await loadActiveSubscription(stripe, customerId, user.id);
    await assertNoOpenBilling(stripe, customerId);

    if (intent === "accept_discount") {
      if (isRetentionHoldout(user.id)) throw new Conflict("This offer is not available");
      const discount = await discountEligible(stripe, customerId, sub, all);
      if (!discount.eligible) throw new Conflict("This offer is not available");
      providerAttempted = true;
      await stripe.subscriptions.update(sub.id, {
        discounts: [{ coupon: discount.couponId }],
        metadata: { [RETENTION_ACCEPTED_METADATA_KEY]: new Date().toISOString() },
      }, { idempotencyKey: `pastpaperprep-retention-discount-${intentId}`, timeout: 30000 });
      const verified = await stripe.subscriptions.retrieve(sub.id, { expand: ["discounts"] });
      const applied = verified.discounts?.some((d) => typeof d !== "string" && (typeof d.source?.coupon === "string" ? d.source.coupon : d.source?.coupon?.id) === discount.couponId);
      if (verified.id !== sub.id || verified.customer !== customerId || verified.metadata?.user_id !== user.id || verified.status !== "active" || verified.cancel_at_period_end || !applied || verified.items?.data?.[0]?.current_period_end !== periodEnd) throw new Error("Stripe retention discount readback mismatch");
      await release(admin, user.id, intentId);
      held = false;
      return json({ status: "discount_applied", percentOff: RETENTION_DISCOUNT_PERCENT, nextPaymentAt: new Date(periodEnd * 1000).toISOString() });
    }

    const desired = intent === "cancel";
    if (sub.cancel_at_period_end !== desired) {
      providerAttempted = true;
      const params: Stripe.SubscriptionUpdateParams = { cancel_at_period_end: desired };
      if (desired && reason) params.cancellation_details = { feedback: STRIPE_CANCEL_FEEDBACK[reason] };
      await stripe.subscriptions.update(sub.id, params, { idempotencyKey: `pastpaperprep-cancel-${intent}-${intentId}`, timeout: 30000 });
    }
    const verified = await stripe.subscriptions.retrieve(sub.id);
    if (verified.id !== sub.id || verified.customer !== customerId || verified.metadata?.user_id !== user.id || verified.cancel_at_period_end !== desired || verified.status !== "active" || verified.items?.data?.length !== 1 || verified.items.data[0].current_period_end !== periodEnd || verified.schedule || verified.pending_update) throw new Error("Stripe cancellation readback mismatch");
    await release(admin, user.id, intentId);
    held = false;
    return json({ status: desired ? "canceling" : "active", cancelAtPeriodEnd: desired, effectiveAt: new Date(periodEnd * 1000).toISOString() });
  } catch (error) {
    if (held && !providerAttempted) {
      const { error: releaseError } = await admin.rpc("release_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
      if (releaseError) console.error("Billing reservation cleanup failed");
      held = false;
    }
    if (error instanceof Conflict) return json({ error: error.message }, 409);
    console.error("Stripe subscription cancellation failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return json({ error: "Subscription cancellation is temporarily unavailable" }, 503);
  }
}

async function release(admin: Admin, userId: string, intentId: string) {
  const { data: released, error: releaseError } = await admin.rpc("release_billing_checkout", { p_user_id: userId, p_intent_id: intentId });
  if (releaseError || released !== true) throw new Error("Billing reservation release failed");
}

/** Read-only: decides which single offer (if any) to show. Every write is rechecked by its own intent. */
async function offer(admin: Admin, userId: string, reason: CancelReason | null) {
  try {
    const { data: customerId, error: customerError } = await admin.rpc("get_stripe_customer_id", { p_user_id: userId });
    if (customerError) throw customerError;
    if (typeof customerId !== "string" || !customerId) throw new Conflict("No billing account found");
    const stripe = createStripeClient(getStripeConfig().secretKey);
    const { sub, all } = await loadActiveSubscription(stripe, customerId, userId);
    if (sub.cancel_at_period_end) throw new Conflict("Cancellation is already scheduled");
    const interval = monthlyOrAnnual(sub);
    const plan = planShapeFromMetadata(sub.metadata);
    const holdout = isRetentionHoldout(userId);
    // The holdout runs the same checks so its logged eligibleOffer matches what it would have seen.
    const [discount, lastActivityAt] = await Promise.all([
      interval && plan ? discountEligible(stripe, customerId, sub, all) : { eligible: false },
      lastStudyActivity(admin, userId),
    ]);
    // An unrecognised plan shape gets no plan offer (only the harmless "coming soon" link).
    return json(chooseRetentionOffer({ reason, plan: plan ?? "single", interval: interval ?? "annual", discountEligible: discount.eligible, holdout, lastActivityAt, now: new Date() }));
  } catch (error) {
    if (error instanceof Conflict) return json({ error: error.message }, 409);
    console.error("Retention offer lookup failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return json({ error: "Offer lookup is unavailable" }, 503);
  }
}

export const POST = withFailureReporting("/api/billing/subscription/cancellation", handlePOST);
