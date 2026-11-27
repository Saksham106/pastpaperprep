import {
  buildReminderEmail, evaluateReminder, formatRenewalAmount, maskEmail, otherAccessOutlasts, otherSubscriptionOutlasts, planLabel, undoWouldWork,
  type EntitlementLike, type PlanEditable, type ReminderInterval, type ReminderSubscription,
} from "@/lib/access-end-reminder";
import type { EmailMessage, EmailResult } from "@/lib/transactional-email";

/**
 * The daily "your access ends soon" run. All I/O is injected so the rules can be tested without
 * Stripe or Supabase. Reads are live Stripe (the synced row doesn't store a scheduled cancellation).
 *
 * Dry run reads everything and writes nothing. A real run claims (subscription, end) in the
 * database before sending, so two overlapping runs or a retry never email twice.
 */

export type ReminderJobDeps = {
  /** Every `active` subscription with a scheduled cancellation, across all customers. */
  listCancellingSubscriptions(): Promise<ReminderSubscription[]>;
  listCustomerSubscriptions(customerId: string): Promise<ReminderSubscription[]>;
  /** An open Checkout session or invoice: the undo route refuses until it is resolved. */
  hasOpenBilling(customerId: string): Promise<boolean>;
  planEditable: PlanEditable;
  customerIdFor(userId: string): Promise<string | null>;
  entitlementsFor(userId: string): Promise<EntitlementLike[]>;
  emailFor(userId: string): Promise<{ email: string; confirmed: boolean } | null>;
  /** The renewal the student would pay if they keep their plan; null when Stripe can't say. */
  previewRenewal(customerId: string, subscriptionId: string): Promise<{ cents: number; currency: string } | null>;
  alreadyReminded(subscriptionId: string, endsAt: string): Promise<boolean>;
  claim(subscriptionId: string, endsAt: string, userId: string): Promise<boolean>;
  finish(subscriptionId: string, endsAt: string, status: "sent" | "failed"): Promise<void>;
  send(message: EmailMessage): Promise<EmailResult>;
};

export type ReminderOutcome =
  | "would_send" | "sent" | "send_failed" | "send_retry_later"
  | "already_reminded" | "owner_mismatch" | "other_access" | "undo_unavailable" | "no_confirmed_email" | "lookup_failed";

export type ReminderRow = {
  outcome: ReminderOutcome;
  /** Masked; the full address never leaves the server. */
  email: string | null;
  plan: string;
  interval: ReminderInterval;
  endsAt: string;
  daysLeft: number;
  renewal: string | null;
};

export type ReminderRunResult = {
  dryRun: boolean;
  scanned: number;
  notDue: number;
  rows: ReminderRow[];
  counts: Partial<Record<ReminderOutcome, number>>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A safety cap: about 60 subscriptions exist today; far more due in one day means something is wrong. */
export const MAX_REMINDERS_PER_RUN = 50;

function customerIdOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  return null;
}

export async function runAccessEndReminders(deps: ReminderJobDeps, options: { nowSeconds: number; dryRun: boolean; siteUrl: string }): Promise<ReminderRunResult> {
  const { nowSeconds, dryRun, siteUrl } = options;
  const subscriptions = await deps.listCancellingSubscriptions();
  const due = subscriptions.flatMap((subscription) => {
    const evaluation = evaluateReminder(subscription, nowSeconds);
    return evaluation.due ? [{ subscription, evaluation }] : [];
  });
  if (due.length > MAX_REMINDERS_PER_RUN) throw new Error("Access-end reminder run exceeds its safety cap");

  const rows: ReminderRow[] = [];
  for (const { subscription, evaluation } of due) {
    const endsAt = new Date(evaluation.endsAt * 1000).toISOString();
    const row: ReminderRow = {
      outcome: "lookup_failed", email: null, plan: planLabel(evaluation.plan), interval: evaluation.interval, endsAt,
      daysLeft: Math.round(((evaluation.endsAt - nowSeconds) / 86_400) * 10) / 10, renewal: null,
    };
    rows.push(row);
    try {
      const userId = subscription.metadata?.user_id;
      const customerId = customerIdOf(subscription.customer);
      if (!userId || !UUID.test(userId) || !customerId) { row.outcome = "owner_mismatch"; continue; }
      // The subscription's owner must match the account's own customer mapping.
      if (await deps.customerIdFor(userId) !== customerId) { row.outcome = "owner_mismatch"; continue; }

      const [customerSubscriptions, entitlements, account] = await Promise.all([
        deps.listCustomerSubscriptions(customerId), deps.entitlementsFor(userId), deps.emailFor(userId),
      ]);
      if (customerSubscriptions.some((other) => customerIdOf(other.customer) !== customerId || (other.metadata?.user_id !== undefined && other.metadata.user_id !== userId))) { row.outcome = "owner_mismatch"; continue; }
      if (otherSubscriptionOutlasts(customerSubscriptions, subscription.id, evaluation.endsAt) || otherAccessOutlasts(entitlements, evaluation.endsAt)) { row.outcome = "other_access"; continue; }
      // Only remind students whose "Keep my plan" works: legacy prices, extra subscriptions or an open bill would land on an error.
      if (!undoWouldWork(customerSubscriptions, subscription.id, { customerId, userId }, deps.planEditable) || await deps.hasOpenBilling(customerId)) { row.outcome = "undo_unavailable"; continue; }
      if (!account?.confirmed || !account.email) { row.outcome = "no_confirmed_email"; continue; }
      row.email = maskEmail(account.email);
      // A real run lets the claim decide, so a stale claim (timed-out send) can be retried; the dry run just reports.
      if (dryRun && await deps.alreadyReminded(subscription.id, endsAt)) { row.outcome = "already_reminded"; continue; }

      const preview = await deps.previewRenewal(customerId, subscription.id).catch(() => null);
      row.renewal = preview ? formatRenewalAmount(preview.cents, preview.currency, evaluation.interval) : null;
      if (dryRun) { row.outcome = "would_send"; continue; }

      if (!await deps.claim(subscription.id, endsAt, userId)) { row.outcome = "already_reminded"; continue; }
      const email = buildReminderEmail({ plan: evaluation.plan, endsAt: evaluation.endsAt, renewal: row.renewal, siteUrl });
      const result = await deps.send({ to: account.email, ...email, idempotencyKey: `access-end-reminder/${subscription.id}/${evaluation.endsAt}` });
      if (result.ok) {
        row.outcome = "sent";
        // Sent is sent: a failed bookkeeping write leaves the claim, and any retry reuses the idempotency key.
        await deps.finish(subscription.id, endsAt, "sent").catch(() => undefined);
      } else if (result.retryable) {
        // The claim stays: the next run retries once with the same idempotency key.
        row.outcome = "send_retry_later";
      } else {
        await deps.finish(subscription.id, endsAt, "failed");
        row.outcome = "send_failed";
      }
    } catch {
      row.outcome = "lookup_failed";
    }
  }

  const counts: Partial<Record<ReminderOutcome, number>> = {};
  for (const row of rows) counts[row.outcome] = (counts[row.outcome] ?? 0) + 1;
  return { dryRun, scanned: subscriptions.length, notDue: subscriptions.length - due.length, rows, counts };
}
