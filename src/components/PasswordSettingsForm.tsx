"use client";

import { useActionState } from "react";
import { Key } from "@phosphor-icons/react";
import { updatePassword } from "@/app/auth/actions";
import { initialMagicLinkState } from "@/lib/auth";

export function PasswordSettingsForm() {
  const [state, action, pending] = useActionState(updatePassword, initialMagicLinkState);

  return (
    <form className="auth-form" action={action}>
      <label htmlFor="new-password">New password</label>
      <input id="new-password" name="password" type="password" minLength={12} maxLength={72} autoComplete="new-password" required />
      <small>Use 12–72 characters. A short passphrase is easiest to remember.</small>
      <label htmlFor="password-confirmation">Confirm new password</label>
      <input id="password-confirmation" name="passwordConfirmation" type="password" minLength={12} maxLength={72} autoComplete="new-password" required />
      <button className="button secondary" type="submit" disabled={pending}>
        <Key weight="bold" />
        {pending ? "Saving…" : "Save password"}
      </button>
      {state.message && <p className={`form-message ${state.status}`} role="status">{state.message}</p>}
    </form>
  );
}
