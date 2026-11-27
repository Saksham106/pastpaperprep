import { readEditableCurrentPlan, type AccountPlanSubscription } from "@/lib/account-plan-target";
import type { StripeConfig } from "@/lib/stripe-config";

/**
 * "Your access ends soon": a service reminder for students who turned off renewal but are still
 * in their paid period. Pure rules shared by the daily email job and the on-site notice.
 *
 * Billing state only: the privacy page promises study activity is never used to contact anyone.
 * No offer, no discount: it states the end date and links to the existing undo.
 */

/** Days before the scheduled end that the reminder goes out (and the on-site notice shows). */
export const REMINDER_LEAD_DAYS = { monthly: 3, annual: 7 } as const;
/** Closer than this to the end, a first email would arrive too late to be useful. */
export const REMINDER_MIN_LEAD_SECONDS = 12 * 3600;
/** Where "Keep my plan" goes: the cancel flow opens on its Undo step for a cancelling plan. */
export const KEEP_PLAN_PATH = "/subscription/cancel?from=reminder";

export type ReminderInterval = keyof typeof REMINDER_LEAD_DAYS;
export type ReminderPlan = "single" | "builder" | "all";

export type ReminderSubscription = {
  id: string;
  status: string;
  customer: unknown;
  metadata?: Record<string, string> | null;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
  pause_collection?: unknown;
  schedule?: unknown;
  pending_update?: unknown;
  items?: { data?: { current_period_end?: unknown; price?: { recurring?: { interval?: unknown; interval_count?: unknown } | null } | null }[] };
};

/** What the browser needs for the on-site notice. Nothing here identifies the customer. */
export type AccessEndingNotice = { endsAt: string; interval: ReminderInterval };

export type ReminderSkip =
  | "not_cancelling" | "not_active" | "paused" | "pending_change" | "unexpected_shape" | "separate_cancel_date"
  | "unknown_interval" | "not_due" | "too_late";

export type ReminderEvaluation =
  | { due: true; subscriptionId: string; endsAt: number; interval: ReminderInterval; plan: ReminderPlan | null }
  | { due: false; reason: ReminderSkip };

const ACTIVE_ACCESS = new Set(["active", "trialing", "past_due"]);

function customerIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  return null;
}

function intervalOf(subscription: ReminderSubscription): ReminderInterval | null {
  const recurring = subscription.items?.data?.[0]?.price?.recurring;
  if (recurring?.interval_count !== 1) return null;
  if (recurring.interval === "month") return "monthly";
  if (recurring.interval === "year") return "annual";
  return null;
}

/** Plan shape from the subscription's own metadata (mirrors planShapeFromMetadata in retention-offer). */
export function reminderPlan(metadata: Record<string, string> | null | undefined): ReminderPlan | null {
  const product = metadata?.product_id;
  if (!product) return null;
  if (product === "bundle_all") return "all";
  if (product.startsWith("bank_")) return "single";
  if (product === "bundle_custom") {
    try {
      const ids: unknown = JSON.parse(metadata?.selected_bank_ids ?? "");
      if (!Array.isArray(ids) || ids.length < 1) return null;
      return ids.length === 1 ? "single" : "builder";
    } catch { return null; }
  }
  return product.startsWith("bundle_") ? "builder" : null;
}

export function planLabel(plan: ReminderPlan | null): string {
  if (plan === "all") return "All Access";
  if (plan === "builder") return "Build Your Plan";
  if (plan === "single") return "One Bank";
  return "PastPaperPrep";
}

/**
 * Is this subscription's scheduled end inside its reminder window? Mirrors what the undo route
 * accepts (one item, no schedule or pending update, any cancel date equal to the period end),
 * so "Keep my plan" works for everyone who is reminded.
 */
export function evaluateReminder(subscription: ReminderSubscription, nowSeconds: number): ReminderEvaluation {
  const skip = (reason: ReminderSkip): ReminderEvaluation => ({ due: false, reason });
  if (subscription.status !== "active") return skip("not_active");
  if (subscription.cancel_at_period_end !== true) return skip("not_cancelling");
  if (subscription.pause_collection) return skip("paused");
  if (subscription.schedule != null || subscription.pending_update) return skip("pending_change");
  const items = subscription.items?.data;
  if (!Array.isArray(items) || items.length !== 1) return skip("unexpected_shape");
  const periodEnd = items[0].current_period_end;
  if (typeof periodEnd !== "number" || !Number.isSafeInteger(periodEnd) || periodEnd <= 0) return skip("unexpected_shape");
  if (subscription.cancel_at != null && subscription.cancel_at !== periodEnd) return skip("separate_cancel_date");
  const interval = intervalOf(subscription);
  if (!interval) return skip("unknown_interval");
  const remaining = periodEnd - nowSeconds;
  if (remaining > REMINDER_LEAD_DAYS[interval] * 86_400) return skip("not_due");
  if (remaining < REMINDER_MIN_LEAD_SECONDS) return skip("too_late");
  return { due: true, subscriptionId: subscription.id, endsAt: periodEnd, interval, plan: reminderPlan(subscription.metadata) };
}

/** Another of the customer's plans keeps access going (renewing, or ending later than this one). */
export function otherSubscriptionOutlasts(subscriptions: readonly ReminderSubscription[], subscriptionId: string, endsAt: number): boolean {
  return subscriptions.some((subscription) => {
    if (subscription.id === subscriptionId || !ACTIVE_ACCESS.has(subscription.status)) return false;
    if (subscription.cancel_at_period_end !== true && subscription.cancel_at == null) return true;
    const end = subscription.cancel_at ?? subscription.items?.data?.[0]?.current_period_end;
    return typeof end !== "number" || end > endsAt;
  });
}

export type EntitlementLike = { product_id?: unknown; status?: unknown; source?: unknown; expires_at?: unknown };

/**
 * Whole-site access that is not this subscription and outlasts it: Lifetime (whose purchase also
 * turns off a subscription's renewal) or a complimentary All Access grant. A partial manual grant
 * doesn't count: the student still loses the banks this plan covered.
 */
export function otherAccessOutlasts(entitlements: readonly EntitlementLike[], endsAt: number): boolean {
  return entitlements.some((row) => {
    if (row.status !== "active" && row.status !== "trialing") return false;
    const wholeSite = row.product_id === "lifetime_all_access" || (row.product_id === "bundle_all" && row.source === "manual");
    if (!wholeSite) return false;
    if (row.expires_at === null || row.expires_at === undefined) return true;
    const expires = typeof row.expires_at === "string" ? Date.parse(row.expires_at) : NaN;
    // An unreadable date counts as outlasting: fail towards not emailing someone who keeps access.
    return !Number.isFinite(expires) || expires > endsAt * 1000;
  });
}

/** Is this plan on a current price and product the account editor can manage (readEditableCurrentPlan)? */
export type PlanEditable = (subscription: ReminderSubscription) => boolean;

/** readEditableCurrentPlan as a yes/no, judged as if renewal were on (as /api/billing/subscription does). */
export function planEditableWith(config: StripeConfig): PlanEditable {
  return (subscription) => {
    try {
      readEditableCurrentPlan({ ...subscription, cancel_at: null, cancel_at_period_end: false, pause_collection: null } as unknown as AccountPlanSubscription, config);
      return true;
    } catch { return false; }
  };
}

/**
 * Would /subscription/cancel offer Undo, and would the undo succeed? Mirrors the `editable` flag of
 * /api/billing/subscription and loadActiveSubscription in the cancellation route: every subscription
 * under the customer belongs to this account, this is the only one not canceled or expired, and its
 * price and product are current. (Open Checkout sessions and invoices are checked by the email job.)
 */
export function undoWouldWork(
  subscriptions: readonly ReminderSubscription[],
  subscriptionId: string,
  { customerId, userId }: { customerId: string; userId: string },
  planEditable: PlanEditable,
): boolean {
  const target = subscriptions.find((subscription) => subscription.id === subscriptionId);
  if (!target) return false;
  if (subscriptions.some((subscription) => customerIdOf(subscription.customer) !== customerId || subscription.metadata?.user_id !== userId)) return false;
  if (subscriptions.some((subscription) => subscription !== target && subscription.status !== "canceled" && subscription.status !== "incomplete_expired")) return false;
  return planEditable(target);
}

/**
 * The on-site notice: the signed-in account's own cancelling plan inside its window, only when
 * "Keep my plan" would work. Display only; Lifetime and complimentary grants are checked by the caller.
 */
export function findAccessEndingNotice(
  subscriptions: readonly ReminderSubscription[],
  { customerId, userId, nowSeconds }: { customerId: string; userId: string; nowSeconds: number },
  planEditable: PlanEditable,
): AccessEndingNotice | null {
  const due = subscriptions.flatMap((subscription) => {
    const evaluation = evaluateReminder(subscription, nowSeconds);
    return evaluation.due ? [evaluation] : [];
  });
  if (due.length !== 1) return null;
  const [ending] = due;
  if (!undoWouldWork(subscriptions, ending.subscriptionId, { customerId, userId }, planEditable)) return null;
  return { endsAt: new Date(ending.endsAt * 1000).toISOString(), interval: ending.interval };
}

/** "December 1" in UTC: the email has no time zone to go on, and the end is a UTC instant. */
export function reminderDate(endsAtSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(endsAtSeconds * 1000));
}

export function formatRenewalAmount(cents: number, currency: string, interval: ReminderInterval): string | null {
  if (!Number.isSafeInteger(cents) || cents <= 0 || !/^[a-z]{3}$/i.test(currency)) return null;
  try {
    const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
    return `${amount}/${interval === "monthly" ? "month" : "year"}`;
  } catch { return null; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}

/**
 * Short, no guilt, one action. A transactional message about the student's own subscription:
 * no offer, so it needs no marketing consent or unsubscribe link.
 */
export function buildReminderEmail(input: { plan: ReminderPlan | null; endsAt: number; renewal: string | null; siteUrl: string }) {
  const date = reminderDate(input.endsAt);
  const plan = planLabel(input.plan);
  const keepUrl = new URL(KEEP_PLAN_PATH, input.siteUrl).href;
  const accountUrl = new URL("/account/subscription", input.siteUrl).href;
  const subject = `Your PastPaperPrep access ends on ${date}`;
  const renews = input.renewal ? `It will renew on ${date} at ${input.renewal}.` : `It will renew on ${date} at your current price.`;
  const lines = [
    `Your ${plan} plan ends on ${date}. You turned off renewal, so you won't be charged again.`,
    `Still studying? Keep your plan and nothing changes: ${keepUrl}`,
    renews,
    "Your saved worksheets stay in your account either way.",
  ];
  const footer = `You're getting this because of your PastPaperPrep subscription. Manage it at ${accountUrl}. Questions: hello@pastpaperprep.com`;
  const text = `${lines.join("\n\n")}\n\n--\n${footer}\n`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#faf8f5;font-family:Georgia,'Times New Roman',serif;color:#1f1d1a">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<p style="margin:0 0 16px;font-size:17px;line-height:1.5">Your ${escapeHtml(plan)} plan ends on <strong>${escapeHtml(date)}</strong>. You turned off renewal, so you won&#39;t be charged again.</p>
<p style="margin:0 0 20px;font-size:17px;line-height:1.5">Still studying? Keep your plan and nothing changes.</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(keepUrl)}" style="display:inline-block;background:#1f1d1a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-family:Arial,sans-serif;font-size:15px">Keep my plan</a></p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#55524c">${escapeHtml(renews)}</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#55524c">Your saved worksheets stay in your account either way.</p>
</div>
<p style="max-width:480px;margin:16px auto 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#7a766f">You&#39;re getting this because of your PastPaperPrep subscription. <a href="${escapeHtml(accountUrl)}" style="color:#7a766f">Manage it</a>. Questions: hello@pastpaperprep.com</p>
</body></html>`;
  return { subject, text, html };
}

/** For dry-run output: enough to recognise the account, not enough to copy the address. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}

export type ReminderMode = "off" | "dry_run" | "send";
export function reminderMode(value = process.env.ACCESS_END_REMINDER_MODE): ReminderMode {
  return value === "send" || value === "dry_run" ? value : "off";
}
