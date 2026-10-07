"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { requestMagicLink } from "@/app/auth/actions";
import { initialMagicLinkState } from "@/lib/auth";

function CheckEmail({ email, next, onEdit }: { email: string; next: string; onEdit: () => void }) {
  const [state, action, pending] = useActionState(requestMagicLink, initialMagicLinkState);
  const [cooldown, setCooldown] = useState(60);
  const deadline = useRef(0);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);

  useEffect(() => { deadline.current = Date.now() + 60_000; heading.current?.focus(); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setCooldown(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!pending && submitting.current) {
      submitting.current = false;
      deadline.current = Date.now() + 60_000;
      if (state.status === "error") alert.current?.focus();
    }
  }, [pending, state]);

  function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || pending || Date.now() < deadline.current) return;
    submitting.current = true;
    deadline.current = Date.now() + 60_000;
    setCooldown(60);
    const data = new FormData(event.currentTarget);
    startTransition(() => { action(data); });
  }

  return (
    <section className="auth-form" aria-labelledby="magic-link-success-heading">
      <h2 id="magic-link-success-heading" ref={heading} tabIndex={-1}>Check your email</h2>
      <p>Look for a PastPaperPrep email at <strong>{email}</strong>. Check your spam or junk folder too.</p>
      <p>Open the link in that email, then press Continue on the page it opens to finish signing in.</p>
      <p>If you requested more than one, use the newest email; older links may stop working.</p>
      <form action={action} onSubmit={resend}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <button className="button secondary auth-submit" type="submit" disabled={pending || cooldown > 0}>
          <PaperPlaneTilt weight="bold" />
          {pending ? "Requesting…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Request another link"}
        </button>
      </form>
      {state.status === "error" && <p ref={alert} tabIndex={-1} className="form-message error" role="alert">{state.message}</p>}
      {state.status === "success" && <p className="form-message success" role="status">Another link was requested. Check your inbox and use the newest email.</p>}
      <button className="auth-mode-switch" type="button" disabled={pending} onClick={onEdit}>Use a different email</button>
    </section>
  );
}

export function MagicLinkForm({ next = "/pricing" }: { next?: string }) {
  const [state, action, pending] = useActionState(requestMagicLink, initialMagicLinkState);
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const submitting = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!pending && submitting.current) {
      submitting.current = false;
      if (state.status === "error") alert.current?.focus();
    }
  }, [pending, state]);
  useEffect(() => { if (editing) emailInput.current?.focus(); }, [editing]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || pending) return;
    submitting.current = true;
    const data = new FormData(event.currentTarget);
    const recipient = String(data.get("email") ?? "").trim();
    data.set("email", recipient);
    setEmail(recipient);
    setEditing(false);
    startTransition(() => { action(data); });
  }

  if (state.status === "success" && !editing && !pending) {
    return <CheckEmail email={email} next={next} onEdit={() => setEditing(true)} />;
  }
  const hasError = state.status === "error" && !pending;
  return (
    <form className={`auth-form${hasError ? " has-error" : ""}`} action={action} onSubmit={submit}>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email">Email address</label>
      <input ref={emailInput} id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" defaultValue={email} aria-invalid={hasError || undefined} required />
      <button className="button primary auth-submit" type="submit" disabled={pending}>
        <PaperPlaneTilt weight="bold" />{pending ? "Sending…" : "Send sign-in link"}
      </button>
      {hasError && <p ref={alert} tabIndex={-1} className="form-message error" role="alert">{state.message}</p>}
    </form>
  );
}
