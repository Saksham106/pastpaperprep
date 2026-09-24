"use client";

import Link from "next/link";
import { useEffect } from "react";
import { trackProductEvent } from "@/lib/product-analytics";

export function FreeQuestionSignupGate({ bankSlug, remainingCount, signupHref, signinHref }: { bankSlug: string; remainingCount: number; signupHref: string; signinHref: string }) {
  useEffect(() => {
    trackProductEvent("free_gate_view", { bank: bankSlug, limit: 20, remainingCount });
  }, [bankSlug, remainingCount]);

  return (
    <section className="free-question-signup-gate" aria-labelledby="free-question-gate-title">
      <div className="free-question-gate-copy">
        <p className="eyebrow">Free account required</p>
        <h2 id="free-question-gate-title">Keep practising for free</h2>
        <p>Create a free account to unlock the remaining {remainingCount.toLocaleString()} free questions in this bank.</p>
        <div className="free-question-gate-actions">
          <Link className="button primary" href={signupHref} onClick={() => trackProductEvent("free_gate_signup_click", { bank: bankSlug, limit: 20, remainingCount })}>Create free account</Link>
          <Link className="free-question-gate-signin" href={signinHref} onClick={() => trackProductEvent("free_gate_signin_click", { bank: bankSlug, limit: 20, remainingCount })}>Already have an account? Sign in</Link>
        </div>
      </div>
      <div className="free-question-gate-teasers" aria-hidden="true">
        <div><span>More free questions</span><i /><i /></div>
        <div><span>Keep your practice going</span><i /><i /></div>
        <div><span>Explore another topic</span><i /><i /></div>
      </div>
    </section>
  );
}
