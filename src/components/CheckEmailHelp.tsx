"use client";

import { useActionState } from "react";
import { verifyEmailCode } from "@/app/auth/actions";
import { initialMagicLinkState } from "@/lib/auth";

export function EmailCodeForm({ email, type, next }: { email: string; type: "email" | "signup"; next: string }) {
  const [state, action, pending] = useActionState(verifyEmailCode, initialMagicLinkState);
  const hasError = state.status === "error" && !pending;
  return (
    <form className={`email-code-form${hasError ? " has-error" : ""}`} action={action}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email-code">Or enter the code from the email</label>
      <div className="email-code-row">
        <input id="email-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 \-]*" maxLength={12} placeholder="8-digit code" aria-invalid={hasError || undefined} required />
        <button className="button primary" type="submit" disabled={pending}>{pending ? "Checking…" : "Confirm"}</button>
      </div>
      {hasError && <p className="form-message error" role="alert">{state.message}</p>}
    </form>
  );
}

export function OrganizationEmailNotice({ onUsePersonal }: { onUsePersonal: () => void }) {
  return (
    <div className="auth-inbox-notice" role="note">
      <p><strong>School or work email?</strong> These inboxes often hold back emails from new senders. If nothing arrives within a minute, use a personal email.</p>
      <button type="button" onClick={onUsePersonal}>Use a personal email</button>
    </div>
  );
}
