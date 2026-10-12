import "server-only";
import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { getAvailableBanks } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Generic sign-ins default to plain /pricing so free users see plans; paid users go to their dashboard instead.
// Explicit destinations (including /pricing with a chosen plan) are kept. A failed access read keeps /pricing, which works for everyone.
export async function postAuthDestination(supabase: SupabaseServerClient, userId: string | undefined, next: string): Promise<string> {
  if (next !== "/pricing" || !userId) return next;
  try {
    const { rows, error } = await fetchAccessEntitlements(supabase as never, userId);
    if (!error && getAvailableBanks().some(({ slug }) => hasBankAccess(slug, rows as AccessEntitlement[]))) return "/dashboard";
  } catch {
    // Fall back to pricing.
  }
  return next;
}
