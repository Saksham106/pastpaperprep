"use client";

import { useActionState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { requestMagicLink } from "@/app/auth/actions";
import { initialMagicLinkState } from "@/lib/auth";

export function MagicLinkForm({ next = "/pricing" }: { next?: string }) {
  const [state, action, pending] = useActionState(requestMagicLink, initialMagicLinkState);
  const hasError = state.status === "error";

  return (
    <form className={`auth-form${hasError ? " has-error" : ""}`} action={action}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={hasError || undefined} required />
      <button className="button primary auth-submit" type="submit" disabled={pending}>
        <PaperPlaneTilt weight="bold" />
        {pending ? "Sending…" : "Send sign-in link"}
      </button>
      {state.message && <p className={`form-message ${state.status}`} role={hasError ? "alert" : "status"}>{state.message}</p>}
    </form>
  );
}
