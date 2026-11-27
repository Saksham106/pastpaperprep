import "server-only";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { createAdminClient } from "@/lib/supabase/admin";

/** Shared by the cancel and pause routes: one active subscription, owned by this user, with no pending change. */

export const LIFECYCLE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
export const lifecycleJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: LIFECYCLE_HEADERS });
export class LifecycleConflict extends Error {}
export type Admin = ReturnType<typeof createAdminClient>;

/** Reads every subscription and returns the single active one, or throws LifecycleConflict. */
export async function loadActiveSubscription(stripe: Stripe, customerId: string, userId: string) {
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
  if (subscriptions.has_more) throw new LifecycleConflict("Subscription list exceeds safe limit");
  if (subscriptions.data.some((s) => s.customer !== customerId || s.metadata?.user_id !== userId)) throw new LifecycleConflict("Stripe billing owner mismatch");
  const active = subscriptions.data.filter((s) => s.status === "active");
  if (active.length !== 1) throw new LifecycleConflict("Exactly one active subscription is required");
  const sub = active[0];
  if (sub.metadata?.user_id !== userId || sub.customer !== customerId || sub.pending_update || sub.schedule) throw new LifecycleConflict("Subscription is not eligible for this change");
  if (sub.items.data.length !== 1) throw new LifecycleConflict("Expected exactly one subscription item");
  const periodEnd = sub.items.data[0].current_period_end;
  if (!Number.isSafeInteger(periodEnd) || periodEnd <= Math.floor(Date.now() / 1000)) throw new LifecycleConflict("Subscription period end is invalid");
  if (sub.cancel_at != null && (!sub.cancel_at_period_end || sub.cancel_at !== periodEnd)) throw new LifecycleConflict("Subscription has a separate cancellation date");
  return { sub, periodEnd, all: subscriptions.data };
}

export async function assertNoOpenBilling(stripe: Stripe, customerId: string) {
  const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
  if (sessions.has_more) throw new LifecycleConflict("Open Checkout session list exceeds safe limit");
  if (sessions.data.length) throw new LifecycleConflict("An open Checkout session must be resolved first");
  const invoices = await stripe.invoices.list({ customer: customerId, status: "open", limit: 100 });
  if (invoices.has_more) throw new LifecycleConflict("Open invoice list exceeds safe limit");
  if (invoices.data.some((invoice) => invoice.customer !== customerId || invoice.status === "open")) throw new LifecycleConflict("An open invoice must be resolved first");
}

export function monthlyOrAnnual(sub: Stripe.Subscription): "monthly" | "annual" | null {
  const recurring = sub.items.data[0]?.price?.recurring;
  if (recurring?.interval === "month" && recurring.interval_count === 1) return "monthly";
  if (recurring?.interval === "year" && recurring.interval_count === 1) return "annual";
  return null;
}

export async function releaseReservation(admin: Admin, userId: string, intentId: string) {
  const { data: released, error: releaseError } = await admin.rpc("release_billing_checkout", { p_user_id: userId, p_intent_id: intentId });
  if (releaseError || released !== true) throw new Error("Billing reservation release failed");
}

/** Pause is a release gate on top of the plan editor until it has been checked with a Stripe test clock. */
export const isPauseEnabled = () => process.env.STRIPE_PAUSE_ENABLED === "true";
