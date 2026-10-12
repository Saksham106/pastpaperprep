"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { requestMagicLink } from "@/app/auth/actions";
import { initialMagicLinkState, isLikelyOrganizationEmail } from "@/lib/auth";
import { CheckEmailHeader, EmailCodeForm, OrganizationEmailNotice } from "@/components/CheckEmailHelp";

function CheckEmail({ email, next, onEdit, onUsePersonal }: { email: string; next: string; onEdit: () => void; onUsePersonal: () => void }) {
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
    <section className="check-email" aria-labelledby="magic-link-success-heading">
      <CheckEmailHeader id="magic-link-success-heading" headingRef={heading} email={email} what="a sign-in link and code" />
      {isLikelyOrganizationEmail(email) && <OrganizationEmailNotice onUsePersonal={onUsePersonal} />}
      <EmailCodeForm email={email} type="email" next={next} />
      <div className="check-email-footer">
        <span>{cooldown === 0 && !isLikelyOrganizationEmail(email) ? "Nothing yet? Check spam." : "Didn’t get it?"}</span>
        <div className="check-email-actions">
          <form action={action} onSubmit={resend}>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="next" value={next} />
            <button className="text-button" type="submit" disabled={pending || cooldown > 0}>
              {pending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
            </button>
          </form>
          <button className="text-button" type="button" disabled={pending} onClick={onEdit}>Change email</button>
        </div>
      </div>
      {state.status === "error" && <p ref={alert} tabIndex={-1} className="form-message error" role="alert">{state.message}</p>}
      {state.status === "success" && <p className="form-message success" role="status">Sent again. Use the newest email.</p>}
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
    return <CheckEmail email={email} next={next} onEdit={() => setEditing(true)} onUsePersonal={() => { setEmail(""); setEditing(true); }} />;
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
