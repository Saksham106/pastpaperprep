"use client";

import { useActionState } from "react";
import { Key, PaperPlaneTilt } from "@phosphor-icons/react";
import { requestPasswordReset, signInWithPassword } from "@/app/auth/actions";
import { initialMagicLinkState } from "@/lib/auth";

export function PasswordSignInForm({ next = "/pricing" }: { next?: string }) {
  const [signInState, signInAction, signInPending] = useActionState(signInWithPassword, initialMagicLinkState);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, initialMagicLinkState);

  return (
    <>
      <form className="auth-form" action={signInAction}>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="password-email">Email address</label>
        <input id="password-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <button className="button primary" type="submit" disabled={signInPending}>
          <Key weight="bold" />
          {signInPending ? "Signing in…" : "Sign in with password"}
        </button>
        {signInState.message && <p className={`form-message ${signInState.status}`} role="status">{signInState.message}</p>}
      </form>

      <details className="password-reset">
        <summary>Forgot your password?</summary>
        <form className="auth-form compact-form" action={resetAction}>
          <label htmlFor="reset-email">Account email</label>
          <input id="reset-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          <button className="button secondary" type="submit" disabled={resetPending}>
            <PaperPlaneTilt weight="bold" />
            {resetPending ? "Sending…" : "Email a reset link"}
          </button>
          {resetState.message && <p className={`form-message ${resetState.status}`} role="status">{resetState.message}</p>}
        </form>
      </details>
    </>
  );
}
