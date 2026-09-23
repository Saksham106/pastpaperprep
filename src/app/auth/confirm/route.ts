import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_CONFIRMATION_TYPES = new Set<EmailOtpType>(["email", "signup", "invite", "recovery"]);

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

  const type = rawType as "email" | "signup" | "invite" | "recovery";
  const next = type === "recovery"
    ? "/account/password"
    : type === "invite"
      ? "/account/password?invited=1"
      : safeNextPath(url.searchParams.get("next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (!error) return NextResponse.redirect(new URL(next, url.origin));

  return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
}
