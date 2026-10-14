"use client";

import { useActionState, useEffect, useRef, type Ref } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { verifyEmailCode } from "@/app/auth/actions";
import { initialMagicLinkState } from "@/lib/auth";
import { useEmailOperationLock, type EmailOperationLock } from "./useEmailOperationLock";

export function EmailCodeForm({ email, type, next, operationLock }: { email: string; type: "email" | "signup"; next: string; operationLock?: EmailOperationLock }) {
  const localLock = useEmailOperationLock();
  const lock = operationLock ?? localLock;
  const { release } = lock;
  const [state, action, pending] = useActionState(verifyEmailCode, initialMagicLinkState);
  const submitting = useRef(false);
  useEffect(() => {
    if (!pending && submitting.current) { submitting.current = false; release(); }
  }, [pending, state, release]);
  const hasError = state.status === "error" && !pending;
  return (
    <form className={`email-code-form${hasError ? " has-error" : ""}`} action={action} onSubmit={(event) => {
      if (submitting.current || !lock.acquire()) { event.preventDefault(); return; }
      submitting.current = true;
    }}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email-code">Enter the code</label>
      <div className="email-code-row">
        <input id="email-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 \-]*" maxLength={12} placeholder="8-digit code" aria-invalid={hasError || undefined} required />
        <button className="button primary" type="submit" disabled={pending || lock.busy}>{pending ? "Checking…" : "Confirm"}</button>
      </div>
      {hasError && <p className="form-message error" role="alert">{state.message}</p>}
    </form>
  );
}

export function CheckEmailHeader({ id, headingRef, email, what }: { id: string; headingRef: Ref<HTMLHeadingElement>; email: string; what: string }) {
  return (
    <div className="check-email-head">
      <span className="check-email-icon" aria-hidden="true"><EnvelopeSimple weight="duotone" /></span>
      <div>
        <h2 id={id} ref={headingRef} tabIndex={-1}>Check your email</h2>
        <p>Look for {what} at <strong>{email}</strong></p>
      </div>
    </div>
  );
}

export function OrganizationEmailNotice({ onUsePersonal, disabled = false }: { onUsePersonal: () => void; disabled?: boolean }) {
  return (
    <div className="auth-inbox-notice" role="note">
      <p><strong>School email?</strong> These often block new senders.</p>
      <button type="button" disabled={disabled} onClick={onUsePersonal}>Use a personal email</button>
    </div>
  );
}
