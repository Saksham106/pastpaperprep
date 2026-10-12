import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { bindReferralToAuthenticatedUser } from "@/lib/referral-account";
import { captureConversionOutcome } from "@/lib/server-conversion-analytics";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Best-effort attribution only; callers must already have verified authentication.
export async function bindVerifiedReferralBestEffort(userId: string, createdAt: string, referralCookie: string | undefined) {
  try {
    await bindReferralToAuthenticatedUser(userId, createdAt, referralCookie);
  } catch {
    // A redeemed token cannot be retried to recover ancillary referral work.
  }
}

// Call only after successful OTP verification. `type` is the provider contract
// that actually succeeded, never an unverified form label. Both paths retain
// the stable signup event key used by the conversion sink for deduplication.
export async function completeEmailVerification(supabase: SupabaseServerClient, type: "email" | "signup", referralCookie: string | undefined) {
  const result = await supabase.auth.getUser().catch(() => null);
  if (!result || result.error) return;
  const { data: { user } } = result;
  if (user?.id && user.created_at) await bindVerifiedReferralBestEffort(user.id, user.created_at, referralCookie);
  // The one-time signup OTP is the authoritative first-confirmation boundary;
  // ordinary sign-in/email tokens must never be counted as account creation.
  if (type === "signup" && user?.id) {
    try {
      await captureConversionOutcome({ outcome: "signup_confirmed", eventKey: `signup:${user.id}`,
        userId: user.id,
        occurredAt: user.email_confirmed_at ?? user.confirmed_at ?? user.created_at });
    } catch {
      // Conversion reporting is ancillary to the already verified session.
    }
  }
}
