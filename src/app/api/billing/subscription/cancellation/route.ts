import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const HEADERS = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS });
class Conflict extends Error {}
type Intent = "cancel" | "undo";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origin not allowed" }, 403);
  if (process.env.STRIPE_PLAN_EDITOR_ENABLED !== "true") return json({ error: "Subscription cancellation is unavailable" }, 404);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Authentication required" }, 401);
  if (!isStripeBillingEnabled()) return json({ error: "Billing is not available" }, 503);
  let intent: Intent;
  try {
    const body = await request.json() as { intent?: unknown };
    if (!body || typeof body !== "object" || Array.isArray(body) || (body.intent !== "cancel" && body.intent !== "undo")) return json({ error: "Invalid cancellation intent" }, 400);
    intent = body.intent;
  } catch { return json({ error: "Invalid JSON" }, 400); }

  const admin = createAdminClient();
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
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    if (subscriptions.has_more) throw new Conflict("Subscription list exceeds safe limit");
    if (subscriptions.data.some((s) => s.customer !== customerId || s.metadata?.user_id !== user.id)) throw new Conflict("Stripe billing owner mismatch");
    const active = subscriptions.data.filter((s) => s.status === "active");
    if (active.length !== 1) throw new Conflict("Exactly one active subscription is required");
    const sub = active[0];
    if (sub.metadata?.user_id !== user.id || sub.customer !== customerId || sub.pending_update || sub.schedule) throw new Conflict("Subscription is not eligible for cancellation");
    if (sub.items.data.length !== 1) throw new Conflict("Expected exactly one subscription item");
    const periodEnd = sub.items.data[0].current_period_end;
    if (!Number.isSafeInteger(periodEnd) || periodEnd <= Math.floor(Date.now() / 1000)) throw new Conflict("Subscription period end is invalid");
    if (sub.cancel_at != null && (!sub.cancel_at_period_end || sub.cancel_at !== periodEnd)) throw new Conflict("Subscription has a separate cancellation date");
    const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
    if (sessions.has_more) throw new Conflict("Open Checkout session list exceeds safe limit");
    if (sessions.data.length) throw new Conflict("An open Checkout session must be resolved first");
    const invoices = await stripe.invoices.list({ customer: customerId, status: "open", limit: 100 });
    if (invoices.has_more) throw new Conflict("Open invoice list exceeds safe limit");
    if (invoices.data.some((invoice) => invoice.customer !== customerId || invoice.status === "open")) throw new Conflict("An open invoice must be resolved first");
    const desired = intent === "cancel";
    if (sub.cancel_at_period_end !== desired) {
      providerAttempted = true;
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: desired }, { idempotencyKey: `pastpaperprep-cancel-${intent}-${intentId}`, timeout: 30000 });
    }
    const verified = await stripe.subscriptions.retrieve(sub.id);
    if (verified.id !== sub.id || verified.customer !== customerId || verified.metadata?.user_id !== user.id || verified.cancel_at_period_end !== desired || verified.status !== "active" || verified.items?.data?.length !== 1 || verified.items.data[0].current_period_end !== periodEnd || verified.schedule || verified.pending_update) throw new Error("Stripe cancellation readback mismatch");
    const { data: released, error: releaseError } = await admin.rpc("release_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
    if (releaseError || released !== true) throw new Error("Billing reservation release failed");
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
