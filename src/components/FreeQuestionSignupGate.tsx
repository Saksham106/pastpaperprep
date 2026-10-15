"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ANONYMOUS_FREE_QUESTION_LIMIT } from "@/lib/free-question-gate";
import { trackProductEvent } from "@/lib/product-analytics";
import { trackUpgrade } from "@/components/UpgradeNudges";
import { UPGRADE_PRICE_MONTH } from "@/lib/upgrade-copy";
import { Testimonial } from "@/components/Testimonial";
import { SIGNUP_GATE_TESTIMONIAL } from "@/lib/testimonials";

const GATE_VIEW_KEY = "signup_gate:";

type GateProps = {
  bankSlug: string;
  remainingCount: number;
  signupHref: string;
  signinHref: string;
  plansHref?: string;
  plansLine?: string;
  /** Page-lived set shared with the other upgrade nudges, so a gate remounted by filtering is not counted again. */
  sentViews?: Set<string>;
  /** Free questions in the whole bank, so a filtered view can show the full free value, not just its own count. */
  bankFreeCount?: number;
  bankName?: string;
};

type GateMessageProps = GateProps & {
  titleId: string;
};

export function gateValueLine(remainingCount: number, bankFreeCount?: number, bankName?: string) {
  const viewFreeCount = remainingCount + ANONYMOUS_FREE_QUESTION_LIMIT;
  if (!bankFreeCount || !bankName || bankFreeCount < viewFreeCount) return `Create a free account for the other ${remainingCount.toLocaleString()} free questions.`;
  const all = `Create a free account to open all ${bankFreeCount.toLocaleString()} free ${bankName} questions`;
  return bankFreeCount > viewFreeCount ? `${all}, including the other ${remainingCount.toLocaleString()} here.` : `${all}.`;
}

function GateMessage({ bankSlug, remainingCount, signupHref, signinHref, plansHref = "/pricing", plansLine = `Want every year? Plans start at ${UPGRADE_PRICE_MONTH}.`, bankFreeCount, bankName, titleId }: GateMessageProps) {
  const eventProperties = { bank: bankSlug, limit: ANONYMOUS_FREE_QUESTION_LIMIT, remainingCount };

  return (
    <div className="free-question-gate-copy">
      <p className="free-question-gate-kicker">Free account</p>
      <h2 id={titleId}>Keep practising for free</h2>
      <p className="free-question-gate-description">
        {gateValueLine(remainingCount, bankFreeCount, bankName)} {plansLine}
      </p>
      <Testimonial testimonial={SIGNUP_GATE_TESTIMONIAL} variant="inline" />
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

export function FreeQuestionSignupGate({ bankSlug, remainingCount, signupHref, signinHref, plansHref, plansLine, sentViews, bankFreeCount, bankName }: GateProps) {
  const inlineRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasElevatedRef = useRef(false);
  const hasViewedRef = useRef(false);
  const focusFrameRef = useRef<number | null>(null);
  const [elevated, setElevated] = useState(false);

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
      if (!entry?.isIntersecting) return;
      // The gate mounts below 20 questions, so count a view only once it is actually on screen.
      if (!hasViewedRef.current && !sentViews?.has(GATE_VIEW_KEY)) {
        hasViewedRef.current = true;
        sentViews?.add(GATE_VIEW_KEY);
        trackProductEvent("free_gate_view", { bank: bankSlug, limit: ANONYMOUS_FREE_QUESTION_LIMIT, remainingCount });
        trackUpgrade("view", bankSlug, "signup_gate");
      }
      if (entry.intersectionRatio < 0.35 || hasElevatedRef.current) return;

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
    }, { threshold: [0, 0.35], rootMargin: "0px 0px -10% 0px" });

    observer.observe(target);
    return () => observer.disconnect();
  }, [bankSlug, remainingCount, sentViews]);

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
          bankFreeCount={bankFreeCount}
          bankName={bankName}
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
          bankFreeCount={bankFreeCount}
          bankName={bankName}
            titleId="free-question-gate-dialog-title"
          />
        </div>
      </dialog>
    </>
  );
}
