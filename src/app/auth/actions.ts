"use server";

import { redirect } from "next/navigation";
import { isValidEmail, isValidPassword, safeNextPath, type MagicLinkState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function requestMagicLink(
  _previousState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? "/account"));

  if (!isValidEmail(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callbackUrl = new URL("/auth/callback", siteUrl);
  callbackUrl.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { status: "error", message: "We couldn’t send the sign-in link. Try again in a minute." };
  }

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { status: "error", message: "That email or password is incorrect." };
  }

  redirect(next);
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
    return { status: "error", message: "Use 12–72 characters for your password." };
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
