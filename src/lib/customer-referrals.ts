import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

export type CustomerReferralSummary = { code: string; verifiedSignups: number; awardedRewards: number; awardedSignupMilestones: number };

/** Call only after verifying the subject with Supabase auth.getClaims(). */
export async function getCustomerReferralSummary(userId: string, authClient: Awaited<ReturnType<typeof createClient>>): Promise<CustomerReferralSummary | null> {
  // The authenticated RPC derives its subject from auth.uid(); the service key cannot create links.
  const { data: code, error } = await authClient.rpc("ensure_customer_referral_link", {
    p_code: `c_${randomBytes(12).toString("hex")}`,
  });
  if (error) throw new Error("Could not load your referral link");
  if (!code) return null;
  const admin = createAdminClient();
  const [signups, awards, signupAwards] = await Promise.all([
    admin.from("customer_referral_attributions").select("user_id", { count: "exact", head: true }).eq("referrer_user_id", userId),
    admin.from("customer_referral_awards").select("id", { count: "exact", head: true }).eq("referrer_user_id", userId),
    admin.from("customer_referral_awards").select("id", { count: "exact", head: true }).eq("referrer_user_id", userId).eq("kind", "five_signups"),
  ]);
  if (signups.error || awards.error || signupAwards.error || signups.count === null || awards.count === null || signupAwards.count === null) {
    throw new Error("Could not read referral progress");
  }
  return { code, verifiedSignups: signups.count, awardedRewards: awards.count, awardedSignupMilestones: signupAwards.count };
}
