import "server-only";
import { HELPER_WEEKLY_CREDITS, helperWeekStart, helperWeeklyReset, type HelperCredits, type HelperTier } from "@/lib/helper/credits";
import { createAdminClient } from "@/lib/supabase/admin";

/** A charged message: the ledger row a refund names, so it goes back once, to where it was taken from. */
export type HelperCharge = { chargeId: string };
export type HelperAllowance =
  | { status: "ok"; charge: HelperCharge; credits: HelperCredits }
  | { status: "limit"; reason: "week" | "day"; credits: HelperCredits }
  | { status: "busy" } | { status: "disabled" } | { status: "error" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const count = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/**
 * Charges one message for the user. The tier comes from the server's entitlement read and the cost from the request
 * shape, never from the browser; the service-role RPC spends the week's plan credits first, then a pack.
 */
export async function consumeHelperCredits(userId: string, tier: HelperTier, cost: number, now = new Date()): Promise<HelperAllowance> {
  const weekly = HELPER_WEEKLY_CREDITS[tier];
  const resetsAt = helperWeeklyReset(now).toISOString();
  try {
    const { data, error } = await createAdminClient().rpc("consume_helper_credits", { p_user_id: userId, p_weekly_credits: weekly, p_cost: cost });
    if (error) return { status: "error" };
    const result = data as Record<string, unknown> | null;
    const credits = (): HelperCredits | null => count(result?.plan_left) && count(result?.pack_left)
      ? { tier, weekly, planLeft: result.plan_left, packLeft: result.pack_left, resetsAt }
      : null;
    if (result?.status === "ok" && typeof result.charge_id === "string" && UUID.test(result.charge_id)) {
      const balance = credits();
      return balance ? { status: "ok", charge: { chargeId: result.charge_id }, credits: balance } : { status: "error" };
    }
    if (result?.status === "limit" && (result.reason === "week" || result.reason === "day")) {
      const balance = credits();
      return balance ? { status: "limit", reason: result.reason, credits: balance } : { status: "error" };
    }
    if (result?.status === "busy" || result?.status === "disabled") return { status: result.status };
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}

/** Gives back a message whose reply never reached the student. */
export async function releaseHelperCredits(userId: string, charge: HelperCharge): Promise<void> {
  try {
    await createAdminClient().rpc("release_helper_credits", { p_user_id: userId, p_charge_id: charge.chargeId });
  } catch {
    // A lost refund costs the student one message at worst.
  }
}

type ReadClient = { from: (table: string) => unknown };
type Query = {
  select: (columns: string) => Query;
  eq: (column: string, value: unknown) => Query;
  gt: (column: string, value: unknown) => Query;
  order: (column: string, options: { ascending: boolean }) => Query;
  then: PromiseLike<{ data: unknown; error: unknown }>["then"];
};

export type HelperPackBalance = { credits: number; expiresAt: string };

/** The signed-in user's balance, read through their own session (RLS lets them see only their rows). */
export async function readHelperCredits(supabase: ReadClient, userId: string, tier: HelperTier, now = new Date()): Promise<(HelperCredits & { packs: HelperPackBalance[] }) | null> {
  const weekly = HELPER_WEEKLY_CREDITS[tier];
  const table = (name: string) => supabase.from(name) as Query;
  const [week, packs] = await Promise.all([
    table("helper_usage_weekly").select("credits_used").eq("user_id", userId).eq("week_start", helperWeekStart(now)),
    table("helper_credit_packs").select("credits_remaining, expires_at").eq("user_id", userId).eq("status", "active").gt("expires_at", now.toISOString()).order("expires_at", { ascending: true }),
  ]);
  if (week.error || packs.error || !Array.isArray(week.data) || !Array.isArray(packs.data)) return null;
  const used = week.data.length ? (week.data[0] as { credits_used?: unknown }).credits_used : 0;
  if (!count(used)) return null;
  const balances: HelperPackBalance[] = [];
  for (const row of packs.data as { credits_remaining?: unknown; expires_at?: unknown }[]) {
    if (!count(row.credits_remaining) || typeof row.expires_at !== "string") return null;
    if (row.credits_remaining > 0) balances.push({ credits: row.credits_remaining, expiresAt: row.expires_at });
  }
  return {
    tier, weekly,
    planLeft: Math.max(weekly - used, 0),
    packLeft: balances.reduce((sum, pack) => sum + pack.credits, 0),
    resetsAt: helperWeeklyReset(now).toISOString(),
    packs: balances,
  };
}
