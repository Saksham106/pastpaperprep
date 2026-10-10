"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ANONYMOUS_FREE_QUESTION_LIMIT } from "@/lib/free-question-gate";
import { trackProductEvent } from "@/lib/product-analytics";
import { trackUpgrade } from "@/components/UpgradeNudges";

type GateProps = {
  bankSlug: string;
  remainingCount: number;
  signupHref: string;
  signinHref: string;
  plansHref?: string;
  plansLine?: string;
};

type GateMessageProps = GateProps & {
  titleId: string;
};

function GateMessage({ bankSlug, remainingCount, signupHref, signinHref, plansHref = "/pricing", plansLine = "Want every year? Plans start at $6/month.", titleId }: GateMessageProps) {
  const eventProperties = { bank: bankSlug, limit: ANONYMOUS_FREE_QUESTION_LIMIT, remainingCount };

  return (
    <div className="free-question-gate-copy">
      <p className="free-question-gate-kicker">Free account</p>
      <h2 id={titleId}>Keep practising for free</h2>
      <p className="free-question-gate-description">
        Create a free account for the other {remainingCount.toLocaleString()} free questions. {plansLine}
      </p>
      <div className="free-question-gate-actions">
        <Link className="button primary" href={signupHref} onClick={() => trackProductEvent("free_gate_signup_click", eventProperties)}>
          Create free account
        </Link>
        <Link className="button secondary" href={plansHref} onClick={() => trackUpgrade("click", bankSlug, "signup_gate")}>
          See plans
        </Link>
        <p className="free-question-gate-account-link">
          <span>Already have an account?</span>{" "}
          <Link className="free-question-gate-signin" href={signinHref} onClick={() => trackProductEvent("free_gate_signin_click", eventProperties)}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export function FreeQuestionSignupGate({ bankSlug, remainingCount, signupHref, signinHref, plansHref, plansLine }: GateProps) {
  const inlineRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasElevatedRef = useRef(false);
  const focusFrameRef = useRef<number | null>(null);
  const [elevated, setElevated] = useState(false);

  useEffect(() => {
    trackProductEvent("free_gate_view", { bank: bankSlug, limit: ANONYMOUS_FREE_QUESTION_LIMIT, remainingCount });
    trackUpgrade("view", bankSlug, "signup_gate");
  }, [bankSlug, remainingCount]);

  const dismissPrompt = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setElevated(false);
    trackProductEvent("free_gate_dismiss", { bank: bankSlug, limit: ANONYMOUS_FREE_QUESTION_LIMIT, remainingCount });
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      inlineRef.current?.focus({ preventScroll: true });
    });
  }, [bankSlug, remainingCount]);

  useEffect(() => () => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
  }, []);

  useEffect(() => {
    const target = inlineRef.current;
    const dialog = dialogRef.current;
    if (!target || !dialog || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting || entry.intersectionRatio < 0.35 || hasElevatedRef.current) return;

      try {
        dialog.showModal();
      } catch {
        return;
      }
      hasElevatedRef.current = true;
      setElevated(true);
      trackProductEvent("free_gate_elevated", { bank: bankSlug, limit: ANONYMOUS_FREE_QUESTION_LIMIT, remainingCount });
      observer.disconnect();
      if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = window.requestAnimationFrame(() => {
        focusFrameRef.current = null;
        closeButtonRef.current?.focus({ preventScroll: true });
      });
    }, { threshold: 0.35, rootMargin: "0px 0px -10% 0px" });

    observer.observe(target);
    return () => observer.disconnect();
  }, [bankSlug, remainingCount]);

  useEffect(() => {
    if (!elevated) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previousOverflow; };
  }, [elevated]);

  return (
    <>
      <section
        ref={inlineRef}
        className="free-question-signup-gate"
        aria-labelledby="free-question-gate-inline-title"
        aria-hidden={elevated || undefined}
        inert={elevated}
        tabIndex={-1}
      >
        <GateMessage
          bankSlug={bankSlug}
          remainingCount={remainingCount}
          signupHref={signupHref}
          signinHref={signinHref}
          plansHref={plansHref}
          plansLine={plansLine}
          titleId="free-question-gate-inline-title"
        />
      </section>

      <dialog
        ref={dialogRef}
        className="free-question-gate-dialog"
        aria-labelledby="free-question-gate-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          dismissPrompt();
        }}
      >
        <button ref={closeButtonRef} className="free-question-gate-close" type="button" aria-label="Close account prompt" onClick={dismissPrompt}>
          <span aria-hidden="true">×</span>
        </button>
        <div className="free-question-gate-dialog-focus">
          <GateMessage
            bankSlug={bankSlug}
            remainingCount={remainingCount}
            signupHref={signupHref}
            signinHref={signinHref}
            plansHref={plansHref}
            plansLine={plansLine}
            titleId="free-question-gate-dialog-title"
          />
        </div>
      </dialog>
    </>
  );
}
