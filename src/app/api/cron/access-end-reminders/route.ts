import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { planEditableWith, reminderMode, type ReminderSubscription } from "@/lib/access-end-reminder";
import { runAccessEndReminders, type ReminderJobDeps } from "@/lib/access-end-reminder-job";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled, type StripeConfig } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail, transactionalEmailConfig } from "@/lib/transactional-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };
const MAX_PAGES = 20;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/** Vercel's scheduler sends `Authorization: Bearer $CRON_SECRET`. No secret configured: nobody gets in. */
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function liveDeps(stripe: Stripe, admin: ReturnType<typeof createAdminClient>, emailConfig: ReturnType<typeof transactionalEmailConfig>, config: StripeConfig): ReminderJobDeps {
  return {
    planEditable: planEditableWith(config),
    async hasOpenBilling(customerId) {
      const [sessions, invoices] = await Promise.all([
        stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 1 }),
        stripe.invoices.list({ customer: customerId, status: "open", limit: 1 }),
      ]);
      return sessions.data.length > 0 || invoices.data.length > 0;
    },
    async listCancellingSubscriptions() {
      const found: ReminderSubscription[] = [];
      let startingAfter: string | undefined;
      for (let page = 0; ; page += 1) {
        if (page === MAX_PAGES) throw new Error("Subscription list exceeds safe read limit");
        const result = await stripe.subscriptions.list({ status: "active", limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
        for (const subscription of result.data) {
          if (subscription.cancel_at_period_end || subscription.cancel_at != null) found.push(subscription as unknown as ReminderSubscription);
        }
        if (!result.has_more) return found;
        startingAfter = result.data.at(-1)?.id;
        if (!startingAfter) throw new Error("Stripe subscription pagination did not advance");
      }
    },
    async listCustomerSubscriptions(customerId) {
      const result = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
      if (result.has_more) throw new Error("Customer subscription list exceeds safe limit");
      return result.data as unknown as ReminderSubscription[];
    },
    async customerIdFor(userId) {
      const { data, error } = await admin.rpc("get_stripe_customer_id", { p_user_id: userId });
      if (error) throw error;
      return typeof data === "string" && data ? data : null;
    },
    async entitlementsFor(userId) {
      const { data, error } = await admin.from("entitlements").select("product_id,status,source,expires_at").eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
    async emailFor(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) throw error;
      const user = data.user;
      if (!user?.email) return null;
      return { email: user.email, confirmed: Boolean(user.email_confirmed_at) };
    },
    async previewRenewal(customerId, subscriptionId) {
      const preview = await stripe.invoices.createPreview({ customer: customerId, subscription: subscriptionId, subscription_details: { cancel_at_period_end: false } });
      return Number.isSafeInteger(preview.total) && preview.total > 0 && typeof preview.currency === "string" ? { cents: preview.total, currency: preview.currency } : null;
    },
    async alreadyReminded(subscriptionId, endsAt) {
      const { data, error } = await admin.from("subscription_end_reminders").select("status").eq("subscription_id", subscriptionId).eq("ends_at", endsAt).maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    async claim(subscriptionId, endsAt, userId) {
      const { data, error } = await admin.rpc("claim_subscription_end_reminder", { p_subscription_id: subscriptionId, p_ends_at: endsAt, p_user_id: userId });
      if (error) throw error;
      return data === true;
    },
    async finish(subscriptionId, endsAt, status) {
      const { error } = await admin.rpc("finish_subscription_end_reminder", { p_subscription_id: subscriptionId, p_ends_at: endsAt, p_status: status });
      if (error) throw error;
    },
    async send(message) {
      if (!emailConfig) return { ok: false, retryable: false };
      return sendTransactionalEmail(message, emailConfig);
    },
  };
}

/**
 * Daily "your access ends soon" reminders (vercel.json `schedules`).
 * ACCESS_END_REMINDER_MODE: `off` (default, does nothing), `dry_run` (lists who would be emailed),
 * `send`. `?dry_run=1` always lists without writing or sending, whatever the mode.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return json({ error: "Unauthorized" }, 401);
  const mode = reminderMode();
  const explicitDryRun = new URL(request.url).searchParams.get("dry_run") === "1";
  if (mode === "off" && !explicitDryRun) return json({ status: "off" });
  const dryRun = mode !== "send" || explicitDryRun;
  if (!isStripeBillingEnabled()) return json({ error: "Billing is not available" }, 503);
  // "Keep my plan" lands on the cancel flow's undo, which only works with the plan editor on.
  if (process.env.STRIPE_PLAN_EDITOR_ENABLED !== "true") return json({ error: "Undo is unavailable, so no reminders" }, 409);
  const emailConfig = transactionalEmailConfig();
  if (!dryRun && !emailConfig) return json({ error: "Email is not configured" }, 503);

  try {
    const config = getStripeConfig();
    const result = await runAccessEndReminders(
      liveDeps(createStripeClient(config.secretKey), createAdminClient(), emailConfig, config),
      { nowSeconds: Math.floor(Date.now() / 1000), dryRun, siteUrl: config.siteUrl },
    );
    console.info("Access-end reminders", { dryRun: result.dryRun, scanned: result.scanned, notDue: result.notDue, counts: result.counts });
    return json(result);
  } catch (error) {
    console.error("Access-end reminder run failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return json({ error: "Reminder run failed" }, 503);
  }
}
