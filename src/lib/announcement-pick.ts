import { annualSavingPercent, priceForBankCount, PRICING_MODEL } from "@/lib/pricing-model";
import type { BankSlug } from "@/lib/banks";
import type { QualificationId } from "@/lib/qualifications";

/** Browser-safe half of the dashboard "for you" cards: choosing, dismissing and the annual nudge. Never imports the changelog. */
export type AnnouncementKind = "bank_add" | "bank_included" | "bank_free" | "new_papers" | "feature" | "annual";
export type AnnouncementLink = { label: string; href: string };
export type Announcement = {
  /** The update's anchor id ("2026-11-24-ib-business-management-hl-and-sl"), or "annual" for the plan nudge. */
  id: string;
  kind: AnnouncementKind;
  eyebrow: string;
  title: string;
  body?: string;
  /** A link, or an in-page action (Pepper opens its panel). */
  cta: AnnouncementLink | { label: string; action: "pepper" };
  secondary?: AnnouncementLink;
  /** Lower comes first. New banks, then the annual nudge, then new papers, then features. */
  tier: number;
  date: string;
  board?: QualificationId;
  bank?: BankSlug;
};

export const ANNOUNCEMENT_MAX_AGE_DAYS = 30;
/** At most this many cards in the dashboard's sliding strip. */
export const ANNOUNCEMENT_SLIDES = 3;
/** A dismissed annual nudge comes back after this long, so it stays occasional. */
export const ANNUAL_SNOOZE_DAYS = 60;
const DAY = 86_400_000;

export type AnnualOffer = { percent: number; monthlyCents: number; annualCents: number };

type BillingSnapshot = {
  subscriptions?: { status?: unknown; cancelAtPeriodEnd?: unknown; pendingUpdate?: unknown; scheduledChange?: unknown; bankSelection?: { kind?: unknown; banks?: unknown }; items?: { recurringSubtotalCents?: unknown; price?: { currency?: unknown; interval?: unknown; intervalCount?: unknown } }[] }[];
  management?: { editable?: unknown };
};

/**
 * "Switch to annual and save N%", from the reader's own monthly charge and the annual price of the
 * same plan. Only for one active, editable, monthly subscription with nothing scheduled. Editable
 * plans are on today's prices, so the annual figure is the one the plan editor will quote.
 */
export function annualOfferFrom(snapshot: unknown): AnnualOffer | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const { subscriptions, management } = snapshot as BillingSnapshot;
  if (management?.editable !== true || !Array.isArray(subscriptions)) return null;
  const current = subscriptions.filter((sub) => sub.status !== "canceled" && sub.status !== "incomplete_expired");
  if (current.length !== 1) return null;
  const [sub] = current;
  if (sub.status !== "active" || sub.cancelAtPeriodEnd !== false || sub.pendingUpdate || sub.scheduledChange || sub.items?.length !== 1) return null;
  const [item] = sub.items;
  const monthlyCents = item.recurringSubtotalCents;
  if (item.price?.interval !== "month" || (item.price.intervalCount != null && item.price.intervalCount !== 1) || item.price.currency !== "usd") return null;
  if (typeof monthlyCents !== "number" || !Number.isSafeInteger(monthlyCents) || monthlyCents <= 0) return null;
  const selection = sub.bankSelection;
  const count = selection?.kind === "selected" && Array.isArray(selection.banks) ? selection.banks.length : 0;
  const annualCents = selection?.kind === "all" ? PRICING_MODEL.allAccess.annualCents : count > 0 ? priceForBankCount("annual", count) : null;
  if (annualCents === null) return null;
  const percent = annualSavingPercent(monthlyCents, annualCents);
  return percent >= 5 ? { percent, monthlyCents, annualCents } : null;
}

const perMonth = (cents: number) => { const value = Math.round(cents) / 100; return `$${Number.isInteger(value) ? value : value.toFixed(2)}`; };

/** Said per month on purpose: a yearly total reads as a bigger bill than the one they pay now. */
export function annualAnnouncement(offer: AnnualOffer, now = new Date()): Announcement {
  return {
    id: "annual", kind: "annual", eyebrow: "Your plan", tier: 1, date: now.toISOString().slice(0, 10),
    title: `Switch to annual and save ${offer.percent}%`,
    body: `${perMonth(offer.annualCents / 12)} a month instead of ${perMonth(offer.monthlyCents)}, billed yearly.`,
    cta: { label: "Switch to annual", href: "/pricing?interval=annual&from=announcement" },
  };
}

/** Dismissed ids with the time they were dismissed (ms). */
export type Dismissals = Record<string, number>;

export function isDismissed(id: string, dismissals: Dismissals, now = new Date()): boolean {
  const at = dismissals[id];
  if (typeof at !== "number") return false;
  return id === "annual" ? now.getTime() - at < ANNUAL_SNOOZE_DAYS * DAY : true;
}

/** The one card to show: not dismissed, on the reader's board when we know it, lowest tier, newest. */
type RankOptions = { dismissals?: Dismissals; boards?: readonly QualificationId[]; now?: Date };

/** The cards to show, best first: not dismissed, on the reader's board when we know it, lowest tier, newest. */
export function rankAnnouncements(candidates: readonly Announcement[], { dismissals = {}, boards = [], now = new Date() }: RankOptions, limit = ANNOUNCEMENT_SLIDES): Announcement[] {
  const relevant = candidates.filter((item) => !isDismissed(item.id, dismissals, now) && (!item.board || !boards.length || boards.includes(item.board)));
  return [...relevant].sort((a, b) => a.tier - b.tier || b.date.localeCompare(a.date)).slice(0, limit);
}

/** The single best card. */
export function pickAnnouncement(candidates: readonly Announcement[], options: RankOptions): Announcement | null {
  return rankAnnouncements(candidates, options, 1)[0] ?? null;
}

/** Keeps the stored list small: dismissals of updates too old to be shown again are forgotten. */
export function pruneDismissals(dismissals: Dismissals, now = new Date()): Dismissals {
  const keepFor = Math.max(ANNOUNCEMENT_MAX_AGE_DAYS, ANNUAL_SNOOZE_DAYS) * DAY * 2;
  return Object.fromEntries(Object.entries(dismissals).filter(([, at]) => typeof at === "number" && now.getTime() - at < keepFor));
}
