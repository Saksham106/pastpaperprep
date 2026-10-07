import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bindReferralToAuthenticatedUser } from "@/lib/referral-account";
import { REFERRAL_COOKIE } from "@/lib/referral";
import { captureConversionOutcome } from "@/lib/server-conversion-analytics";
import { createAuthAttemptId, logAuthDiagnostic, validAuthAttemptId } from "@/lib/auth-diagnostics";

const ALLOWED_CONFIRMATION_TYPES = new Set<EmailOtpType>(["email", "signup", "recovery"]);

function validTokenHash(value: string | null): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,256}$/.test(value);
}

function methodNotAllowed() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}

export async function GET() {
  return methodNotAllowed();
}

export async function HEAD() {
  return methodNotAllowed();
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  let attemptId = createAuthAttemptId();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    logAuthDiagnostic({ attemptId, phase: "confirmation_result", outcome: "rejected", providerCode: "validation_failed" });
    return NextResponse.redirect(new URL("/login?error=confirmation", url.origin), 303);
  }
  const rawAttempt = form.get("auth_attempt");
  if (validAuthAttemptId(rawAttempt)) attemptId = rawAttempt;
  logAuthDiagnostic({ attemptId, phase: "confirmation_requested" });
  const tokenHash = form.get("token_hash");
  const rawType = form.get("type");

  if (typeof tokenHash !== "string" || !validTokenHash(tokenHash) || typeof rawType !== "string" || !ALLOWED_CONFIRMATION_TYPES.has(rawType as EmailOtpType)) {
    logAuthDiagnostic({ attemptId, phase: "confirmation_result", outcome: "rejected", providerCode: "validation_failed" });
    return NextResponse.redirect(new URL("/login?error=confirmation", url.origin), 303);
  }

  const type = rawType as "email" | "signup" | "recovery";
  const next = type === "recovery"
    ? "/account/password"
    : safeNextPath(typeof form.get("next") === "string" ? form.get("next") as string : null);

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let error: { code?: string } | null;
  try {
    supabase = await createClient();
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } catch {
    logAuthDiagnostic({ attemptId, phase: "confirmation_result", outcome: "rejected", providerCode: "unexpected_failure" });
    return NextResponse.redirect(new URL("/login?error=confirmation", url.origin), 303);
  }
  if (!error) {
    logAuthDiagnostic({ attemptId, phase: "confirmation_result", outcome: "verified" });
    if (type !== "recovery") {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && user.created_at) await bindReferralToAuthenticatedUser(user.id, user.created_at, request.cookies.get(REFERRAL_COOKIE)?.value);
      // The one-time signup OTP is the authoritative first-confirmation boundary;
      // ordinary sign-in/email tokens must never be counted as account creation.
      if (type === "signup" && user?.id) {
        await captureConversionOutcome({ outcome: "signup_confirmed", eventKey: `signup:${user.id}`,
 userId: user.id,
 occurredAt: user.email_confirmed_at ?? user.confirmed_at ?? user.created_at });
      }
    }
    return NextResponse.redirect(new URL(next, url.origin), 303);
  }

  logAuthDiagnostic({ attemptId, phase: "confirmation_result", outcome: "rejected", providerCode: error.code ?? "unknown" });
  return NextResponse.redirect(new URL("/login?error=confirmation", url.origin), 303);
}
