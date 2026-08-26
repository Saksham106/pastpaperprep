"use client";

import { useActionState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { requestMagicLink } from "@/app/auth/actions";
import { initialMagicLinkState } from "@/lib/auth";

export function MagicLinkForm({ next = "/pricing" }: { next?: string }) {
  const [state, action, pending] = useActionState(requestMagicLink, initialMagicLinkState);

  return (
    <form className="auth-form" action={action}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      <button className="button primary" type="submit" disabled={pending}>
        <PaperPlaneTilt weight="bold" />
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state.message && <p className={`form-message ${state.status}`} role="status">{state.message}</p>}
    </form>
  );
}
