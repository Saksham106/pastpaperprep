import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** A spent helper message: which day it was charged to, so a refund goes back to that same day. */
export type HelperCharge = { remaining: number; usageDate: string | null; version: 1 | 2 };
export type HelperAllowance =
  | { status: "ok"; charge: HelperCharge }
  | { status: "limit" | "busy" | "disabled" | "error" };

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Spends one helper message for the signed-in user (the RPC reads auth.uid()). Uses the dated v2 RPC with its kill
 * switch and site-wide cap, falling back to v1 only while the v2 migration isn't applied (PostgREST PGRST202).
 */
export async function consumeHelperAllowance(supabase: RpcClient, limit: number): Promise<HelperAllowance> {
  const v2 = await supabase.rpc("consume_helper_allowance_v2", { p_limit: limit });
  if (!v2.error) {
    const data = v2.data as { status?: unknown; remaining?: unknown; usage_date?: unknown } | null;
    if (data?.status === "ok" && typeof data.remaining === "number" && typeof data.usage_date === "string" && DATE.test(data.usage_date)) {
      return { status: "ok", charge: { remaining: data.remaining, usageDate: data.usage_date, version: 2 } };
    }
    if (data?.status === "limit" || data?.status === "busy" || data?.status === "disabled") return { status: data.status };
    return { status: "error" };
  }
  if (v2.error.code !== "PGRST202") return { status: "error" };
  const v1 = await supabase.rpc("consume_helper_allowance", { p_limit: limit });
  if (v1.error || typeof v1.data !== "number") return { status: "error" };
  return v1.data < 0 ? { status: "limit" } : { status: "ok", charge: { remaining: v1.data, usageDate: null, version: 1 } };
}

/** Gives back a message whose reply never reached the student, on the day it was charged. */
export async function releaseHelperAllowance(userId: string, charge: HelperCharge): Promise<void> {
  try {
    const admin = createAdminClient();
    if (charge.version === 2 && charge.usageDate) {
      await admin.rpc("release_helper_allowance_v2", { p_user_id: userId, p_usage_date: charge.usageDate });
    } else {
      await admin.rpc("release_helper_allowance", { p_user_id: userId });
    }
  } catch {
    // A lost refund costs the student one message at worst.
  }
}
