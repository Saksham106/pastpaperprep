"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UserPlus } from "@phosphor-icons/react";
import { createAccountWithPassword, resendSignupConfirmation } from "@/app/auth/actions";
import { initialMagicLinkState } from "@/lib/auth";

const RESEND_COOLDOWN_MS = 60_000;

export function PasswordSignUpForm({ next = "/pricing" }: { next?: string }) {
  const [state, action, pending] = useActionState(createAccountWithPassword, initialMagicLinkState);
  const [resendState, resendAction, resending] = useActionState(resendSignupConfirmation, initialMagicLinkState);
  const [editing, setEditing] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const submittingRef = useRef(false);
  const resendingRef = useRef(false);
  const checkEmailHeading = useRef<HTMLHeadingElement>(null);
  const [now, setNow] = useState(0);
  const hasError = state.status === "error";
  const checkingEmail = state.status === "success" && !editing && !pending;
  useEffect(() => {
    if (pending) return;
    const completedSubmission = submittingRef.current;
    submittingRef.current = false;
    if (completedSubmission && state.status === "success") setEditing(false);
  }, [pending, state]);
  useEffect(() => {
    if (!resending) resendingRef.current = false;
  }, [resending]);

  useEffect(() => {
    if (!checkingEmail) return;
    checkEmailHeading.current?.focus();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [checkingEmail]);

  useEffect(() => {
    if (!checkingEmail || cooldownUntil === 0) return;
    const remaining = cooldownUntil - Date.now();
    if (remaining <= 0) return;
    const timeout = window.setTimeout(() => setCooldownUntil(0), remaining);
    return () => window.clearTimeout(timeout);
  }, [checkingEmail, cooldownUntil]);

  if (checkingEmail) {
    const seconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
    return (
      <section className="auth-form" aria-labelledby="signup-check-email-title">
        <h2 id="signup-check-email-title" ref={checkEmailHeading} tabIndex={-1}>Check your email</h2>
        <p>A confirmation email has been requested for <strong>{submittedEmail}</strong>.</p>
        <p>Check your inbox, including spam or junk. Open the link, then press Continue to finish creating your account.</p>
        <p>If you request another link, use the newest email.</p>
        <form action={resendAction} onSubmit={(event) => {
          if (resendingRef.current || Date.now() < cooldownUntil) { event.preventDefault(); return; }
          resendingRef.current = true;
          setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
          setNow(Date.now());
        }}>
          <input type="hidden" name="email" value={submittedEmail} />
          <input type="hidden" name="next" value={next} />
          <button className="button primary auth-submit" type="submit" disabled={seconds > 0 || resending}>
            {resending ? "Sending…" : seconds > 0 ? `Resend available in ${seconds}s` : "Resend confirmation email"}
          </button>
          {resendState.message && <p className={`form-message ${resendState.status}`} role={resendState.status === "error" ? "alert" : "status"}>{resendState.message}</p>}
        </form>
        <button className="button secondary" type="button" onClick={() => setEditing(true)}>Change email</button>
      </section>
    );
  }

  return (
    <form className={`auth-form${hasError ? " has-error" : ""}`} action={action} onSubmit={(event) => {
      if (submittingRef.current) { event.preventDefault(); return; }
      submittingRef.current = true;
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      setSubmittedEmail(String(new FormData(event.currentTarget).get("email") ?? "").trim().toLowerCase());
    }}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="signup-email">Email address</label>
      <input id="signup-email" name="email" type="email" autoComplete="email" defaultValue={submittedEmail} placeholder="you@example.com" aria-invalid={hasError || undefined} required />
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
