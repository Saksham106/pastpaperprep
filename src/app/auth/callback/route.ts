import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bindReferralToAuthenticatedUser } from "@/lib/referral-account";
import { REFERRAL_COOKIE } from "@/lib/referral";
import { captureConversionOutcome } from "@/lib/server-conversion-analytics";

// A first Google sign-in creates an already-confirmed account; count it like an email signup confirmation.
function isFirstOAuthSignIn(user: { app_metadata?: { provider?: string }; created_at?: string; last_sign_in_at?: string }) {
  if (!user.app_metadata?.provider || user.app_metadata.provider === "email" || !user.created_at || !user.last_sign_in_at) return false;
  return Math.abs(Date.parse(user.last_sign_in_at) - Date.parse(user.created_at)) < 120_000;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && user.created_at) await bindReferralToAuthenticatedUser(user.id, user.created_at, request.cookies.get(REFERRAL_COOKIE)?.value);
      if (user?.id && isFirstOAuthSignIn(user)) {
        await captureConversionOutcome({ outcome: "signup_confirmed", eventKey: `signup:${user.id}`, userId: user.id, occurredAt: user.created_at });
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
