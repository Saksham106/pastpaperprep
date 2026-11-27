import { describe, expect, it } from "vitest";
import {
  buildReminderEmail, evaluateReminder, findAccessEndingNotice, formatRenewalAmount, maskEmail, otherAccessOutlasts,
  otherSubscriptionOutlasts, reminderMode, REMINDER_MIN_LEAD_SECONDS, undoWouldWork, type ReminderSubscription,
} from "@/lib/access-end-reminder";

const NOW = 1_800_000_000;
const DAY = 86_400;
const USER = "00000000-0000-4000-8000-000000000001";

function sub(overrides: Partial<ReminderSubscription> & { periodEnd?: number; interval?: string } = {}): ReminderSubscription {
  const { periodEnd = NOW + 2 * DAY, interval = "month", ...rest } = overrides;
  return {
    id: "sub_ending00001", status: "active", customer: "cus_1", metadata: { user_id: USER, product_id: "bundle_custom", selected_bank_ids: JSON.stringify(["igcse", "igcse-additional"]) },
    cancel_at_period_end: true, cancel_at: periodEnd, pause_collection: null, schedule: null, pending_update: null,
    items: { data: [{ current_period_end: periodEnd, price: { recurring: { interval, interval_count: 1 } } }] },
    ...rest,
  };
}

describe("evaluateReminder", () => {
  it("is due 3 days before a monthly plan ends", () => {
    expect(evaluateReminder(sub({ periodEnd: NOW + 3 * DAY }), NOW)).toEqual({ due: true, subscriptionId: "sub_ending00001", endsAt: NOW + 3 * DAY, interval: "monthly", plan: "builder" });
    expect(evaluateReminder(sub({ periodEnd: NOW + 3 * DAY + 1 }), NOW)).toEqual({ due: false, reason: "not_due" });
  });

  it("is due 7 days before an annual plan ends", () => {
    expect(evaluateReminder(sub({ periodEnd: NOW + 7 * DAY, interval: "year" }), NOW)).toMatchObject({ due: true, interval: "annual" });
    expect(evaluateReminder(sub({ periodEnd: NOW + 7 * DAY + 1, interval: "year" }), NOW)).toEqual({ due: false, reason: "not_due" });
  });

  it("catches up after a missed run, but not in the last 12 hours", () => {
    expect(evaluateReminder(sub({ periodEnd: NOW + DAY }), NOW).due).toBe(true);
    expect(evaluateReminder(sub({ periodEnd: NOW + REMINDER_MIN_LEAD_SECONDS - 1 }), NOW)).toEqual({ due: false, reason: "too_late" });
  });

  it("skips plans the undo link can't keep, and plans that aren't ending", () => {
    expect(evaluateReminder(sub({ cancel_at_period_end: false, cancel_at: null }), NOW)).toEqual({ due: false, reason: "not_cancelling" });
    expect(evaluateReminder(sub({ status: "past_due" }), NOW)).toEqual({ due: false, reason: "not_active" });
    expect(evaluateReminder(sub({ pause_collection: { behavior: "void" } }), NOW)).toEqual({ due: false, reason: "paused" });
    expect(evaluateReminder(sub({ schedule: "sub_sched_1" }), NOW)).toEqual({ due: false, reason: "pending_change" });
    expect(evaluateReminder(sub({ pending_update: { expires_at: 1 } }), NOW)).toEqual({ due: false, reason: "pending_change" });
    expect(evaluateReminder(sub({ cancel_at: NOW + DAY }), NOW)).toEqual({ due: false, reason: "separate_cancel_date" });
    expect(evaluateReminder(sub({ interval: "week" }), NOW)).toEqual({ due: false, reason: "unknown_interval" });
    const twoItems = sub();
    twoItems.items!.data!.push(twoItems.items!.data![0]);
    expect(evaluateReminder(twoItems, NOW)).toEqual({ due: false, reason: "unexpected_shape" });
  });
});

describe("other access", () => {
  it("a renewing plan, or one ending later, keeps access going", () => {
    const ending = sub();
    expect(otherSubscriptionOutlasts([ending], ending.id, NOW + 2 * DAY)).toBe(false);
    expect(otherSubscriptionOutlasts([ending, sub({ id: "sub_other000001", cancel_at_period_end: false, cancel_at: null })], ending.id, NOW + 2 * DAY)).toBe(true);
    expect(otherSubscriptionOutlasts([ending, sub({ id: "sub_other000001", periodEnd: NOW + 20 * DAY })], ending.id, NOW + 2 * DAY)).toBe(true);
    expect(otherSubscriptionOutlasts([ending, sub({ id: "sub_other000001", status: "canceled", cancel_at_period_end: false, cancel_at: null })], ending.id, NOW + 2 * DAY)).toBe(false);
  });

  it("Lifetime and complimentary All Access count; partial or Stripe-synced grants don't", () => {
    const end = NOW + 2 * DAY;
    expect(otherAccessOutlasts([{ product_id: "lifetime_all_access", status: "active", source: "stripe", expires_at: null }], end)).toBe(true);
    expect(otherAccessOutlasts([{ product_id: "bundle_all", status: "active", source: "manual", expires_at: new Date((end + DAY) * 1000).toISOString() }], end)).toBe(true);
    expect(otherAccessOutlasts([{ product_id: "bundle_all", status: "active", source: "manual", expires_at: new Date((end - DAY) * 1000).toISOString() }], end)).toBe(false);
    expect(otherAccessOutlasts([{ product_id: "bank_igcse", status: "active", source: "manual", expires_at: null }], end)).toBe(false);
    expect(otherAccessOutlasts([{ product_id: "bundle_all", status: "active", source: "stripe", expires_at: null }], end)).toBe(false);
    expect(otherAccessOutlasts([{ product_id: "lifetime_all_access", status: "revoked", source: "stripe", expires_at: null }], end)).toBe(false);
    expect(otherAccessOutlasts([{ product_id: "lifetime_all_access", status: "active", source: "stripe", expires_at: "not a date" }], end)).toBe(true);
  });
});

describe("undoWouldWork", () => {
  const owner = { customerId: "cus_1", userId: USER };
  const editable = () => true;

  it("matches what the cancel flow's Undo accepts", () => {
    const ending = sub();
    expect(undoWouldWork([ending], ending.id, owner, editable)).toBe(true);
    expect(undoWouldWork([ending, sub({ id: "sub_old0000001", status: "canceled" }), sub({ id: "sub_exp0000001", status: "incomplete_expired" })], ending.id, owner, editable)).toBe(true);
  });

  it("refuses legacy plans, extra live subscriptions and loose ownership", () => {
    const ending = sub();
    expect(undoWouldWork([ending], ending.id, owner, () => false)).toBe(false);
    expect(undoWouldWork([ending, sub({ id: "sub_second00001", periodEnd: NOW + DAY })], ending.id, owner, editable)).toBe(false);
    expect(undoWouldWork([ending, sub({ id: "sub_pastdue0001", status: "past_due" })], ending.id, owner, editable)).toBe(false);
    // The undo route rejects a customer with any subscription lacking this account's owner, cancelled ones included.
    expect(undoWouldWork([ending, sub({ id: "sub_old0000001", status: "canceled", metadata: {} })], ending.id, owner, editable)).toBe(false);
    expect(undoWouldWork([sub({ customer: "cus_other" })], ending.id, owner, editable)).toBe(false);
    expect(undoWouldWork([], ending.id, owner, editable)).toBe(false);
  });
});

describe("findAccessEndingNotice", () => {
  const owner = { customerId: "cus_1", userId: USER, nowSeconds: NOW };
  const editable = () => true;

  it("returns the end date and interval for the student's own ending plan", () => {
    expect(findAccessEndingNotice([sub()], owner, editable)).toEqual({ endsAt: new Date((NOW + 2 * DAY) * 1000).toISOString(), interval: "monthly" });
  });

  it("shows nothing outside the window, for another owner, when another plan is live, or when Keep my plan wouldn't work", () => {
    expect(findAccessEndingNotice([sub({ periodEnd: NOW + 10 * DAY })], owner, editable)).toBeNull();
    expect(findAccessEndingNotice([sub({ metadata: { user_id: "00000000-0000-4000-8000-000000000002" } })], owner, editable)).toBeNull();
    expect(findAccessEndingNotice([sub({ customer: "cus_other" })], owner, editable)).toBeNull();
    expect(findAccessEndingNotice([sub(), sub({ id: "sub_other000001", cancel_at_period_end: false, cancel_at: null })], owner, editable)).toBeNull();
    expect(findAccessEndingNotice([sub()], owner, () => false)).toBeNull();
  });
});

describe("buildReminderEmail", () => {
  it("states the date, the plan and one undo link, with no offer", () => {
    const email = buildReminderEmail({ plan: "builder", endsAt: Date.UTC(2026, 11, 1, 9) / 1000, renewal: "$10.00/month", siteUrl: "https://pastpaperprep.com" });
    expect(email.subject).toBe("Your PastPaperPrep access ends on December 1");
    expect(email.text).toContain("Your Build Your Plan plan ends on December 1. You turned off renewal, so you won't be charged again.");
    expect(email.text).toContain("https://pastpaperprep.com/subscription/cancel?from=reminder");
    expect(email.text).toContain("It will renew on December 1 at $10.00/month.");
    expect(email.html).toContain('href="https://pastpaperprep.com/subscription/cancel?from=reminder"');
    expect(email.html).toContain("Keep my plan");
    for (const body of [email.text, email.html]) expect(body).not.toMatch(/%|discount|off your|offer/i);
  });

  it("falls back to 'your current price' when the renewal amount is unknown", () => {
    const email = buildReminderEmail({ plan: null, endsAt: Date.UTC(2026, 11, 1) / 1000, renewal: null, siteUrl: "https://pastpaperprep.com" });
    expect(email.text).toContain("Your PastPaperPrep plan ends on December 1");
    expect(email.text).toContain("at your current price.");
  });
});

describe("helpers", () => {
  it("formats the renewal and refuses nonsense", () => {
    expect(formatRenewalAmount(1000, "usd", "monthly")).toBe("$10.00/month");
    expect(formatRenewalAmount(8400, "usd", "annual")).toBe("$84.00/year");
    expect(formatRenewalAmount(0, "usd", "monthly")).toBeNull();
    expect(formatRenewalAmount(1000, "u$d", "monthly")).toBeNull();
  });

  it("masks emails for dry-run output", () => {
    expect(maskEmail("student@example.com")).toBe("s***@example.com");
    expect(maskEmail("nope")).toBe("***");
  });

  it("defaults the mode to off", () => {
    expect(reminderMode(undefined)).toBe("off");
    expect(reminderMode("yes")).toBe("off");
    expect(reminderMode("dry_run")).toBe("dry_run");
    expect(reminderMode("send")).toBe("send");
  });
});
