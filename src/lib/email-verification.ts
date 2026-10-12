import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { bindReferralToAuthenticatedUser } from "@/lib/referral-account";
import { captureConversionOutcome } from "@/lib/server-conversion-analytics";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Shared by the emailed link (/auth/confirm) and the typed code so both count signups and referrals the same way.
export async function completeEmailVerification(supabase: SupabaseServerClient, type: "email" | "signup", referralCookie: string | undefined) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id && user.created_at) await bindReferralToAuthenticatedUser(user.id, user.created_at, referralCookie);
  // The one-time signup OTP is the authoritative first-confirmation boundary;
  // ordinary sign-in/email tokens must never be counted as account creation.
  if (type === "signup" && user?.id) {
    await captureConversionOutcome({ outcome: "signup_confirmed", eventKey: `signup:${user.id}`,
 userId: user.id,
 occurredAt: user.email_confirmed_at ?? user.confirmed_at ?? user.created_at });
  }
}
