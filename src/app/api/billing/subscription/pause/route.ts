import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { isPauseMonths, pauseStateOf, pauseWindow, PAUSE_ACCESS_UNTIL_KEY, PAUSE_RESUME_MARGIN_MS, PAUSE_RESUMES_AT_KEY, type PauseMonths } from "@/lib/subscription-pause";
import {
  assertNoOpenBilling, isPauseEnabled, lifecycleJson as json, LifecycleConflict as Conflict, loadActiveSubscription, monthlyOrAnnual, releaseReservation,
} from "@/lib/subscription-lifecycle";

export const runtime = "nodejs";
type Intent = "pause" | "undo" | "resume_now";
const INTENTS = new Set<unknown>(["pause", "undo", "resume_now"]);
/** Clock-skew allowance between this server and Stripe when checking the new period started "now". */
const SKEW_MS = 60_000;

async function handlePOST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origin not allowed" }, 403);
  if (process.env.STRIPE_PLAN_EDITOR_ENABLED !== "true") return json({ error: "Pausing is unavailable" }, 404);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Authentication required" }, 401);
  if (!isStripeBillingEnabled()) return json({ error: "Billing is not available" }, 503);
  let intent: Intent;
  let months: PauseMonths | null = null;
  try {
    const body = await request.json() as { intent?: unknown; months?: unknown };
    if (!body || typeof body !== "object" || Array.isArray(body) || !INTENTS.has(body.intent)) return json({ error: "Invalid pause intent" }, 400);
    intent = body.intent as Intent;
    if (intent === "pause") {
      // The flag only stops new bookings: anyone already paused can always undo or resume.
      if (!isPauseEnabled()) return json({ error: "Pausing is unavailable" }, 404);
      if (!isPauseMonths(body.months)) return json({ error: "Choose 1, 2 or 3 months" }, 400);
      months = body.months;
    } else if (body.months !== undefined) return json({ error: "Invalid pause intent" }, 400);
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
    const { sub, periodEnd } = await loadActiveSubscription(stripe, customerId, user.id);
    await assertNoOpenBilling(stripe, customerId);
    if (monthlyOrAnnual(sub) !== "monthly") throw new Conflict("Only monthly plans can be paused");
    if (sub.cancel_at_period_end || sub.cancel_at != null) throw new Conflict("Undo the cancellation before pausing");
    const state = pauseStateOf(sub, new Date());
    const owned = (verified: Stripe.Subscription) => verified.id === sub.id && verified.customer === customerId && verified.metadata?.user_id === user.id && verified.status === "active" && verified.items?.data?.length === 1;

    if (intent === "pause") {
      if (sub.pause_collection) throw new Conflict("This subscription is already paused");
      const window = pauseWindow(periodEnd, sub.billing_cycle_anchor, months as PauseMonths);
      providerAttempted = true;
      await stripe.subscriptions.update(sub.id, {
        pause_collection: { behavior: "void", resumes_at: window.stripeResumesAt },
        metadata: window.metadata,
      }, { idempotencyKey: `pastpaperprep-pause-${intentId}`, timeout: 30000 });
      const verified = await stripe.subscriptions.retrieve(sub.id);
      if (!owned(verified) || verified.pause_collection?.behavior !== "void" || verified.pause_collection.resumes_at !== window.stripeResumesAt ||
        verified.metadata?.[PAUSE_ACCESS_UNTIL_KEY] !== window.metadata[PAUSE_ACCESS_UNTIL_KEY] || verified.metadata?.[PAUSE_RESUMES_AT_KEY] !== window.metadata[PAUSE_RESUMES_AT_KEY] ||
        verified.items.data[0].current_period_end !== periodEnd || verified.cancel_at_period_end) throw new Error("Stripe pause readback mismatch");
      await releaseReservation(admin, user.id, intentId);
      held = false;
      return json({ status: "pause_scheduled", months, accessUntil: window.accessUntil.toISOString(), resumesAt: window.resumesAt.toISOString() });
    }

    if (intent === "undo") {
      // Still inside the paid period: cancel the booked pause outright.
      if (state.kind !== "scheduled") throw new Conflict(state.kind === "paused" ? "Your pause has started. Resume now instead." : "No pause is booked");
      providerAttempted = true;
      await stripe.subscriptions.update(sub.id, { pause_collection: "", metadata: { [PAUSE_ACCESS_UNTIL_KEY]: "", [PAUSE_RESUMES_AT_KEY]: "" } }, { idempotencyKey: `pastpaperprep-pause-undo-${intentId}`, timeout: 30000 });
      const verified = await stripe.subscriptions.retrieve(sub.id);
      if (!owned(verified) || verified.pause_collection || verified.metadata?.[PAUSE_ACCESS_UNTIL_KEY] || verified.items.data[0].current_period_end !== periodEnd) throw new Error("Stripe pause undo readback mismatch");
      await releaseReservation(admin, user.id, intentId);
      held = false;
      return json({ status: "active", renewsAt: new Date(periodEnd * 1000).toISOString() });
    }

    // resume_now: the pause has started. Restart billing today at full price (no credit for the voided period),
    // and only if the payment goes through. Moving the resume marker in the same write means that if Stripe did
    // not start a new paid period, the current (voided) period stays capped instead of granting free access.
    if (state.kind !== "paused") throw new Conflict(state.kind === "scheduled" ? "Your pause hasn't started yet. Undo it instead." : "This subscription isn't paused");
    // Only classic billing mode charges for an anchor reset in the same call (with error_if_incomplete, the
    // unpause and the payment then succeed or fail together). Flexible mode would unpause without invoicing.
    if (sub.billing_mode?.type !== "classic") throw new Conflict("Resuming early isn't available for this plan yet. Email hello@pastpaperprep.com and we'll resume it for you.");
    const requestedAt = Date.now();
    const marker = new Date(requestedAt - SKEW_MS + PAUSE_RESUME_MARGIN_MS).toISOString();
    providerAttempted = true;
    try {
      await stripe.subscriptions.update(sub.id, {
        pause_collection: "",
        billing_cycle_anchor: "now",
        proration_behavior: "none",
        payment_behavior: "error_if_incomplete",
        metadata: { [PAUSE_RESUMES_AT_KEY]: marker },
      }, { idempotencyKey: `pastpaperprep-pause-resume-${intentId}`, timeout: 30000 });
    } catch (error) {
      // error_if_incomplete: the card was declined or needs authentication, and nothing was changed.
      if ((error as { type?: string })?.type === "StripeCardError") {
        await releaseReservation(admin, user.id, intentId);
        held = false;
        return json({ error: "Payment didn't go through. Update your card in Billing, then try again." }, 402);
      }
      throw error;
    }
    const verified = await stripe.subscriptions.retrieve(sub.id, { expand: ["latest_invoice"] });
    const item = verified.items?.data?.[0];
    const invoice = typeof verified.latest_invoice === "object" ? verified.latest_invoice : null;
    if (!owned(verified) || verified.pause_collection || !item || item.current_period_start * 1000 < requestedAt - SKEW_MS ||
      !invoice || invoice.status !== "paid" || !(invoice.amount_paid > 0)) throw new Error("Stripe early resume readback mismatch");
    await releaseReservation(admin, user.id, intentId);
    held = false;
    return json({ status: "resumed", renewsAt: new Date(item.current_period_end * 1000).toISOString() });
  } catch (error) {
    if (held && !providerAttempted) {
      const { error: releaseError } = await admin.rpc("release_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
      if (releaseError) console.error("Billing reservation cleanup failed");
      held = false;
    }
    if (error instanceof Conflict) return json({ error: error.message }, 409);
    console.error("Stripe subscription pause failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return json({ error: "Pausing is temporarily unavailable. Check Billing before trying again." }, 503);
  }
}

export const POST = withFailureReporting("/api/billing/subscription/pause", handlePOST);
