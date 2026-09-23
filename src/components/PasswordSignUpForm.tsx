"use client";

import { useActionState } from "react";
import { UserPlus } from "@phosphor-icons/react";
import { createAccountWithPassword } from "@/app/auth/actions";
import { initialMagicLinkState } from "@/lib/auth";

export function PasswordSignUpForm({ next = "/pricing" }: { next?: string }) {
  const [state, action, pending] = useActionState(createAccountWithPassword, initialMagicLinkState);
  const hasError = state.status === "error";

  return (
    <form className={`auth-form${hasError ? " has-error" : ""}`} action={action}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="signup-email">Email address</label>
      <input id="signup-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={hasError || undefined} required />
      <label htmlFor="signup-password">Password</label>
      <input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} aria-describedby="signup-password-help" aria-invalid={hasError || undefined} required />
      <small id="signup-password-help">Use 12-72 characters.</small>
      <label htmlFor="signup-password-confirmation">Confirm password</label>
      <input id="signup-password-confirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} maxLength={72} aria-invalid={hasError || undefined} required />
      <button className="button primary auth-submit" type="submit" disabled={pending}>
        <UserPlus weight="bold" />
        {pending ? "Creating account…" : "Create account"}
      </button>
      {state.message && <p className={`form-message ${state.status}`} role={hasError ? "alert" : "status"}>{state.message}</p>}
    </form>
  );
}
