"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Records the one-time preferred-source click; the RPC takes the account from the JWT. */
export async function claimPreferredSourceBonus(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_customer_referral_preferred_source_bonus");
  if (error || data !== true) return false;
  revalidatePath("/account/referrals");
  return true;
}
