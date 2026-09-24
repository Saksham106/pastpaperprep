import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bindReferralToAuthenticatedUser } from "@/lib/referral-account";
import { REFERRAL_COOKIE } from "@/lib/referral";

const ALLOWED_CONFIRMATION_TYPES = new Set<EmailOtpType>(["email", "signup", "recovery"]);

function validTokenHash(value: string | null): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,256}$/.test(value);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");

  if (!validTokenHash(tokenHash) || !rawType || !ALLOWED_CONFIRMATION_TYPES.has(rawType as EmailOtpType)) {
    return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
  }

  const type = rawType as "email" | "signup" | "recovery";
  const next = type === "recovery"
    ? "/account/password"
    : safeNextPath(url.searchParams.get("next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (!error) {
    if (type !== "recovery") {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && user.created_at) await bindReferralToAuthenticatedUser(user.id, user.created_at, request.cookies.get(REFERRAL_COOKIE)?.value);
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
}
