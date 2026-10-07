"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { REFERRAL_COOKIE } from "@/lib/referral";
import { isValidEmail, isValidPassword, safeNextPath, type MagicLinkState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { captureConversionOutcome } from "@/lib/server-conversion-analytics";
import { ANALYTICS_CONSENT_VERSION, parseAnalyticsConsent } from "@/lib/analytics-consent";
import { createAuthAttemptId, logAuthDiagnostic } from "@/lib/auth-diagnostics";

export async function requestMagicLink(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? "/account"));

  if (!isValidEmail(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const attemptId = createAuthAttemptId();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const handoffUrl = new URL("/auth/email-link", siteUrl);
  handoffUrl.searchParams.set("next", next);
  handoffUrl.searchParams.set("auth_attempt", attemptId);
  logAuthDiagnostic({ attemptId, phase: "magic_link_requested" });

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: handoffUrl.toString(), shouldCreateUser: true },
    });
    if (error) {
      logAuthDiagnostic({ attemptId, phase: "magic_link_result", outcome: "rejected", providerCode: error.code ?? "unknown" });
      const message = error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit"
        ? "An earlier email may already be on its way. Check your inbox and spam or junk folder, wait a minute, then request another link."
        : "We couldn’t send the sign-in link. Try again in a minute.";
      return { status: "error", message };
    }
  } catch {
    logAuthDiagnostic({ attemptId, phase: "magic_link_result", outcome: "rejected", providerCode: "unexpected_failure" });
    return { status: "error", message: "We couldn’t send the sign-in link. Try again in a minute." };
  }
  logAuthDiagnostic({ attemptId, phase: "magic_link_result", outcome: "accepted" });
  return { status: "success", message: "Check your email. Your secure sign-in link is on its way." };
}

export async function signInWithPassword(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/account"));

  if (!isValidEmail(email) || !password) {
    return { status: "error", message: "Enter your email and password." };
  }

  const attemptId = createAuthAttemptId();
  logAuthDiagnostic({ attemptId, phase: "password_signin_requested" });
  let result: Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["signInWithPassword"]>>;
  try {
    const supabase = await createClient();
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch {
    logAuthDiagnostic({ attemptId, phase: "password_signin_result", outcome: "rejected", providerCode: "unexpected_failure" });
    return { status: "error", message: "We couldn’t sign you in. Try again. If you just signed up, confirm your email first; check your inbox and spam or junk folder." };
  }
  const { error } = result;
  if (error) {
    logAuthDiagnostic({ attemptId, phase: "password_signin_result", outcome: "rejected", providerCode: error.code ?? "unknown" });
    return { status: "error", message: "We couldn’t sign you in. If you just signed up, confirm your email first; check your inbox and spam or junk folder, then try again." };
  }
  logAuthDiagnostic({ attemptId, phase: "password_signin_result", outcome: "accepted" });

  redirect(next);
}

export async function createAccountWithPassword(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/account"));

  if (!isValidEmail(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (!isValidPassword(password)) {
    return { status: "error", message: "Use 12-72 characters for your password." };
  }
  if (password !== confirmation) {
    return { status: "error", message: "Those passwords do not match." };
  }

  const attemptId = createAuthAttemptId();
  logAuthDiagnostic({ attemptId, phase: "signup_requested" });
  const supabase = await createClient().catch(() => null);
  if (!supabase) {
    logAuthDiagnostic({ attemptId, phase: "signup_result", outcome: "rejected", providerCode: "unexpected_failure" });
    return { status: "error", message: "We couldn’t create your account. Try again in a minute." };
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const handoffUrl = new URL("/auth/email-link", siteUrl);
  handoffUrl.searchParams.set("next", next);
  handoffUrl.searchParams.set("auth_attempt", attemptId);
  const consent = parseAnalyticsConsent((await cookies()).get("ppp_analytics_consent")?.value);
  const options = consent === null ? { emailRedirectTo: handoffUrl.toString() } : {
    emailRedirectTo: handoffUrl.toString(),
    data: { analytics_consent: { accepted: consent, version: ANALYTICS_CONSENT_VERSION, updated_at: new Date().toISOString() } },
  };
  const result = await supabase.auth.signUp({
    email,
    password,
    options,
  }).catch(() => null);

  if (!result || result.error) {
    logAuthDiagnostic({ attemptId, phase: "signup_result", outcome: "rejected", providerCode: result?.error?.code ?? (result ? "unknown" : "unexpected_failure") });
    const code = result?.error?.code;
    const message = code === "over_email_send_rate_limit" || code === "over_request_rate_limit"
      ? "An earlier email may already be on its way. Check your inbox and spam or junk folder, wait a minute, then try again."
      : "We couldn’t create your account. Try again in a minute.";
    return { status: "error", message };
  }
  logAuthDiagnostic({ attemptId, phase: "signup_result", outcome: "accepted" });
  const { data } = result;
  if (data.session) {
    if (data.user?.id) {
      await captureConversionOutcome({ userId: data.user.id, outcome: "signup_confirmed", eventKey: `signup:${data.user.id}`, occurredAt: data.user.email_confirmed_at ?? data.user.confirmed_at ?? data.user.created_at });
    }
    if (data.user?.id && data.user.created_at) {
      const { bindReferralToAuthenticatedUser } = await import("@/lib/referral-account");
      await bindReferralToAuthenticatedUser(data.user.id, data.user.created_at, (await cookies()).get(REFERRAL_COOKIE)?.value);
    }
    redirect(next);
  }

  return { status: "success", message: "Check your email to confirm your account." };
}

export async function resendSignupConfirmation(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? "/pricing"));
  if (!isValidEmail(email)) return { status: "error", message: "Enter a valid email address." };

  const attemptId = createAuthAttemptId();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const handoffUrl = new URL("/auth/email-link", siteUrl);
  handoffUrl.searchParams.set("next", next);
  handoffUrl.searchParams.set("auth_attempt", attemptId);
  logAuthDiagnostic({ attemptId, phase: "resend_requested" });
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: handoffUrl.toString() } });
    if (error) {
      logAuthDiagnostic({ attemptId, phase: "resend_result", outcome: "rejected", providerCode: error.code ?? "unknown" });
      return { status: "error", message: "We couldn’t resend the confirmation email. Wait a minute and try again." };
    }
  } catch {
    logAuthDiagnostic({ attemptId, phase: "resend_result", outcome: "rejected", providerCode: "unexpected_failure" });
    return { status: "error", message: "We couldn’t resend the confirmation email. Wait a minute and try again." };
  }
  logAuthDiagnostic({ attemptId, phase: "resend_result", outcome: "accepted" });
  return { status: "success", message: "If the signup is pending, a confirmation email is on its way." };
}

export async function requestPasswordReset(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callbackUrl = new URL("/auth/callback", siteUrl);
  callbackUrl.searchParams.set("next", "/account/password");
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl.toString() });

  return { status: "success", message: "If that account exists, a password-reset link is on its way." };
}

export async function updatePassword(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");

  if (!isValidPassword(password)) {
    return { status: "error", message: "Use 12-72 characters for your password." };
  }
  if (password !== confirmation) {
    return { status: "error", message: "Those passwords do not match." };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return { status: "error", message: "Your session expired. Sign in again first." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { status: "error", message: "We couldn’t save that password. Try again." };
  }

  return { status: "success", message: "Password saved. You can now use either sign-in method." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
