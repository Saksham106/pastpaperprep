"use client";

import { useActionState } from "react";
import { Key, PaperPlaneTilt } from "@phosphor-icons/react";
import { requestPasswordReset, signInWithPassword } from "@/app/auth/actions";
import { initialMagicLinkState } from "@/lib/auth";

export function PasswordSignInForm({ next = "/pricing" }: { next?: string }) {
  const [signInState, signInAction, signInPending] = useActionState(signInWithPassword, initialMagicLinkState);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, initialMagicLinkState);
  const signInError = signInState.status === "error";
  const resetError = resetState.status === "error";

  return (
    <>
      <form className={`auth-form${signInError ? " has-error" : ""}`} action={signInAction}>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="password-email">Email address</label>
        <input id="password-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={signInError || undefined} required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={signInError || undefined} required />
        <button className="button primary auth-submit" type="submit" disabled={signInPending}>
          <Key weight="bold" />
          {signInPending ? "Signing in…" : "Sign in with password"}
        </button>
        {signInState.message && <p className={`form-message ${signInState.status}`} role={signInError ? "alert" : "status"}>{signInState.message}</p>}
      </form>

      <details className="password-reset">
        <summary>Forgot your password?</summary>
        <form className={`auth-form compact-form${resetError ? " has-error" : ""}`} action={resetAction}>
          <label htmlFor="reset-email">Account email</label>
          <input id="reset-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={resetError || undefined} required />
          <button className="button secondary auth-submit" type="submit" disabled={resetPending}>
            <PaperPlaneTilt weight="bold" />
            {resetPending ? "Sending…" : "Email a reset link"}
          </button>
          {resetState.message && <p className={`form-message ${resetState.status}`} role={resetError ? "alert" : "status"}>{resetState.message}</p>}
        </form>
      </details>
    </>
  );
}
