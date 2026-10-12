"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UserPlus } from "@phosphor-icons/react";
import { createAccountWithPassword, resendSignupConfirmation } from "@/app/auth/actions";
import { initialMagicLinkState, isLikelyOrganizationEmail } from "@/lib/auth";
import { useEmailOperationLock } from "./useEmailOperationLock";
import { CheckEmailHeader, EmailCodeForm, OrganizationEmailNotice } from "@/components/CheckEmailHelp";

const RESEND_COOLDOWN_MS = 60_000;

export function PasswordSignUpForm({ next = "/pricing" }: { next?: string }) {
  const [state, action, pending] = useActionState(createAccountWithPassword, initialMagicLinkState);
  const [resendState, resendAction, resending] = useActionState(resendSignupConfirmation, initialMagicLinkState);
  const lock = useEmailOperationLock();
  const { release } = lock;
  const emailInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [showResendFeedback, setShowResendFeedback] = useState(false);
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
    if (!resending && resendingRef.current) {
      resendingRef.current = false;
      release();
    }
  }, [resending, resendState, release]);
  useEffect(() => {
    if (editing) { release(); emailInput.current?.focus(); }
  }, [editing, release]);

  function edit(personal = false) {
    if (!lock.acquire()) return;
    if (personal) setSubmittedEmail("");
    setEditing(true);
  }

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
      <section className="check-email" aria-labelledby="signup-check-email-title">
        <CheckEmailHeader id="signup-check-email-title" headingRef={checkEmailHeading} email={submittedEmail} what="a link and code" />
        {isLikelyOrganizationEmail(submittedEmail) && <OrganizationEmailNotice disabled={lock.busy} onUsePersonal={() => edit(true)} />}
        <EmailCodeForm email={submittedEmail} type="signup" next={next} operationLock={lock} />
        <div className="check-email-footer">
          <span>{seconds === 0 && !isLikelyOrganizationEmail(submittedEmail) ? "Nothing yet? Check spam." : "Didn’t get it?"}</span>
          <div className="check-email-actions">
            <form action={resendAction} onSubmit={(event) => {
              if (resendingRef.current || Date.now() < cooldownUntil || !lock.acquire()) { event.preventDefault(); return; }
              resendingRef.current = true;
              setShowResendFeedback(true);
              setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
              setNow(Date.now());
            }}>
              <input type="hidden" name="email" value={submittedEmail} />
              <input type="hidden" name="next" value={next} />
              <button className="text-button" type="submit" disabled={seconds > 0 || resending || lock.busy}>
                {resending ? "Sending…" : seconds > 0 ? `Resend in ${seconds}s` : "Resend email"}
              </button>
            </form>
            <button className="text-button" type="button" disabled={lock.busy} onClick={() => edit()}>Change email</button>
          </div>
        </div>
        {showResendFeedback && !resending && resendState.message && <p className={`form-message ${resendState.status}`} role={resendState.status === "error" ? "alert" : "status"}>{resendState.status === "success" ? "Requested again. Use the newest email." : resendState.message}</p>}
      </section>
    );
  }

  return (
    <form className={`auth-form${hasError ? " has-error" : ""}`} action={action} onSubmit={(event) => {
      if (submittingRef.current) { event.preventDefault(); return; }
      submittingRef.current = true;
      setShowResendFeedback(false);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      setSubmittedEmail(String(new FormData(event.currentTarget).get("email") ?? "").trim().toLowerCase());
    }}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="signup-email">Email address</label>
      <input ref={emailInput} id="signup-email" name="email" type="email" autoComplete="email" defaultValue={submittedEmail} placeholder="you@example.com" aria-invalid={hasError || undefined} required />
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
