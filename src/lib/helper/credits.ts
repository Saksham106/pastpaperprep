// Browser-safe Pepper credit settings (design: docs/superpowers/specs/2026-11-25-pepper-allowances-design.md).
// Credits are a display unit at 10× messages, with fixed costs, not tied to token spend. The SQL functions in
// supabase/migrations/20261126000000_helper_weekly_credits.sql repeat the pack catalogue and the daily guard.

/** What one message costs. Rule answers (an exact paper, topic or subject opened without AI) cost nothing. */
export const HELPER_CREDIT_COST = { message: 10, photo: 20 } as const;

export const helperCreditCost = (photo: boolean): number => photo ? HELPER_CREDIT_COST.photo : HELPER_CREDIT_COST.message;

export const HELPER_TIERS = ["free", "bank1", "bank2", "bank3", "bank4", "all"] as const;
export type HelperTier = (typeof HELPER_TIERS)[number];

/** Credits each plan gets per week (Monday 00:00 UTC to the next). Lifetime counts as All Access. */
export const HELPER_WEEKLY_CREDITS: Readonly<Record<HelperTier, number>> = {
  free: 150,
  bank1: 700,
  bank2: 1200,
  bank3: 1700,
  bank4: 2200,
  all: 3000,
};

export const HELPER_TIER_LABELS: Readonly<Record<HelperTier, string>> = {
  free: "Free account",
  bank1: "One bank",
  bank2: "2 banks",
  bank3: "3 banks",
  bank4: "4+ banks",
  all: "All Access",
};

/** No account spends more than this in one UTC day, plan and packs together (abuse guard, enforced in SQL). */
export const HELPER_DAILY_CREDIT_GUARD = 1000;

export const HELPER_PACK_CURRENCY = "usd";
export const HELPER_PACKS = [
  { id: "credits_1000", credits: 1000, amountCents: 499 },
  { id: "credits_3000", credits: 3000, amountCents: 1299 },
] as const;
export type HelperPack = (typeof HELPER_PACKS)[number];
export type HelperPackId = HelperPack["id"];

export function helperPack(id: unknown): HelperPack | null {
  return HELPER_PACKS.find((pack) => pack.id === id) ?? null;
}

/** Monday 00:00 UTC of the week holding `now`, as YYYY-MM-DD (the SQL week_start). */
export function helperWeekStart(now = new Date()): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

/** When this week's plan credits come back: next Monday 00:00 UTC. */
export function helperWeeklyReset(now = new Date()): Date {
  const reset = new Date(`${helperWeekStart(now)}T00:00:00Z`);
  reset.setUTCDate(reset.getUTCDate() + 7);
  return reset;
}

/** A student's balance, as the server reports it. */
export type HelperCredits = {
  tier: HelperTier;
  weekly: number;
  planLeft: number;
  packLeft: number;
  /** ISO time the weekly credits reset. */
  resetsAt: string;
};

export function parseHelperCredits(value: unknown): HelperCredits | null {
  if (!value || typeof value !== "object") return null;
  const credits = value as Record<string, unknown>;
  const count = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (!HELPER_TIERS.includes(credits.tier as HelperTier) || !count(credits.weekly) || !count(credits.planLeft) || !count(credits.packLeft)) return null;
  if (typeof credits.resetsAt !== "string" || !Number.isFinite(Date.parse(credits.resetsAt))) return null;
  return { tier: credits.tier as HelperTier, weekly: credits.weekly as number, planLeft: credits.planLeft as number, packLeft: credits.packLeft as number, resetsAt: credits.resetsAt };
}

/** This week's plan credits left as a share of the week, e.g. "64%" ("<1%" rather than 0% while any are left). */
export function percentLeft(credits: Pick<HelperCredits, "planLeft" | "weekly">): string {
  if (credits.weekly <= 0 || credits.planLeft <= 0) return "0%";
  const percent = Math.floor(Math.min(credits.planLeft / credits.weekly, 1) * 100);
  return percent === 0 ? "<1%" : `${percent}%`;
}

const number = new Intl.NumberFormat("en-US");
export const formatCredits = (n: number): string => number.format(n);

/** When the week resets in the reader's own time zone, e.g. "Mon 12 AM" or "Sun 7 PM". */
export function resetDay(resetsAt: string, locale?: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale ?? "en-US", { weekday: "short", hour: "numeric", ...(timeZone ? { timeZone } : {}) }).format(new Date(resetsAt));
}
