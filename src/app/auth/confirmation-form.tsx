"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";

export function ConfirmationForm({ children, className }: { children: ReactNode; className?: string }) {
  const submitted = useRef(false);
  const [busy, setBusy] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (submitted.current) {
      event.preventDefault();
      return;
    }
    submitted.current = true;
    setBusy(true);
    const submitButton = event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
  }

  return (
    <form action="/auth/confirm" method="post" className={className} onSubmit={handleSubmit} aria-busy={busy}>
      {children}
    </form>
  );
}
