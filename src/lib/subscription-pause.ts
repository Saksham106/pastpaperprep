/**
 * Pausing a monthly subscription for 1–3 months (pure helpers, shared by routes, webhook sync and UI).
 *
 * How it works:
 * - The pause starts when the paid period ends (A). Stripe `pause_collection: void` voids the invoices
 *   created while paused, but keeps the subscription `active` and keeps advancing its periods.
 * - So access is capped here, not by Stripe status: the server writes the pause window into subscription
 *   metadata, and any period that starts before the resume boundary gets access only until A.
 * - Stripe resumes collecting a day before the resume boundary, so the boundary invoice is charged normally.
 * - Resuming early restarts billing today (new monthly period from today, full price), like Hulu/Audible.
 */

export const PAUSE_MONTH_OPTIONS = [1, 2, 3] as const;
export type PauseMonths = typeof PAUSE_MONTH_OPTIONS[number];
/** Paid-through date (A): access ends here while paused. */
export const PAUSE_ACCESS_UNTIL_KEY = "pause_access_until";
/** First billing boundary after the pause (B): the renewal that restarts access. */
export const PAUSE_RESUMES_AT_KEY = "pause_resumes_at";
const DAY_MS = 86_400_000;
/** Margin before B: Stripe resumes collection here, and periods starting from here are not capped. */
export const PAUSE_RESUME_MARGIN_MS = DAY_MS;

export function isPauseMonths(value: unknown): value is PauseMonths {
  return typeof value === "number" && (PAUSE_MONTH_OPTIONS as readonly number[]).includes(value);
}

/**
 * The billing boundary `months` after `periodEnd`, using the subscription's anchor day (Stripe bills on the
 * anchor's day of month, or the last day of shorter months) and the period end's time of day.
 */
export function addBillingMonths(periodEnd: Date, anchor: Date, months: number): Date {
  const year = periodEnd.getUTCFullYear();
  const month = periodEnd.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(anchor.getUTCDate(), lastDay);
  return new Date(Date.UTC(year, month, day, periodEnd.getUTCHours(), periodEnd.getUTCMinutes(), periodEnd.getUTCSeconds()));
}

export function pauseWindow(periodEndUnix: number, anchorUnix: number, months: PauseMonths) {
  const accessUntil = new Date(periodEndUnix * 1000);
  const resumesAt = addBillingMonths(accessUntil, new Date(anchorUnix * 1000), months);
  return {
    accessUntil,
    resumesAt,
    /** Stripe `pause_collection.resumes_at` (unix seconds): a day early, so the boundary renewal is collected. */
    stripeResumesAt: Math.floor((resumesAt.getTime() - PAUSE_RESUME_MARGIN_MS) / 1000),
    metadata: { [PAUSE_ACCESS_UNTIL_KEY]: accessUntil.toISOString(), [PAUSE_RESUMES_AT_KEY]: resumesAt.toISOString() },
  };
}

type MetadataLike = Record<string, string> | null | undefined;

/** The pause window written by the server, or null when absent or unreadable. */
export function readPauseWindow(metadata: MetadataLike): { accessUntil: Date; resumesAt: Date } | null {
  const a = Date.parse(metadata?.[PAUSE_ACCESS_UNTIL_KEY] ?? "");
  const b = Date.parse(metadata?.[PAUSE_RESUMES_AT_KEY] ?? "");
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return { accessUntil: new Date(a), resumesAt: new Date(b) };
}

/**
 * Access cap for the webhook sync. A period that starts before the resume boundary (less the margin) is a
 * paused period: its invoice was voided, so access stops at the paid-through date. Returns the capped expiry.
 */
export function capExpiryForPause(expiresAt: string | null, periodStartUnix: number, metadata: MetadataLike, pauseCollectionSet: boolean): string | null {
  if (expiresAt === null) return null;
  const window = readPauseWindow(metadata);
  if (!window) {
    // A pause set outside this app has no paid-through record: don't grant the voided periods.
    return pauseCollectionSet ? new Date(Math.min(Date.parse(expiresAt), periodStartUnix * 1000)).toISOString() : expiresAt;
  }
  if (periodStartUnix * 1000 >= window.resumesAt.getTime() - PAUSE_RESUME_MARGIN_MS) return expiresAt;
  return Date.parse(expiresAt) <= window.accessUntil.getTime() ? expiresAt : window.accessUntil.toISOString();
}

export type PauseState =
  | { kind: "none" }
  /** Pause booked; still in the paid period, so it can be undone. */
  | { kind: "scheduled"; accessUntil: string; resumesAt: string }
  /** Paused now: no access, can resume early. */
  | { kind: "paused"; accessUntil: string; resumesAt: string };

export function pauseStateOf(subscription: { pause_collection?: unknown; metadata?: MetadataLike }, now: Date): PauseState {
  if (!subscription.pause_collection) return { kind: "none" };
  const window = readPauseWindow(subscription.metadata);
  if (!window) return { kind: "none" };
  const dates = { accessUntil: window.accessUntil.toISOString(), resumesAt: window.resumesAt.toISOString() };
  return now.getTime() < window.accessUntil.getTime() ? { kind: "scheduled", ...dates } : { kind: "paused", ...dates };
}
