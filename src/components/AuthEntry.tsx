"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { PasswordSignUpForm } from "@/components/PasswordSignUpForm";
import { SignInMethods } from "@/components/SignInMethods";

type AuthMode = "sign-in" | "sign-up";

export function AuthEntry({ next, hasLinkError = false, hasGoogleError = false, initialMode = "sign-in" }: { next: string; hasLinkError?: boolean; hasGoogleError?: boolean; initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const signingIn = mode === "sign-in";
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousModeRef = useRef(mode);

  useEffect(() => {
    if (previousModeRef.current === mode) return;
    previousModeRef.current = mode;
    headingRef.current?.focus();
  }, [mode]);

  return (
    <>
      <p className="eyebrow">{signingIn ? "Your study space" : "Start studying"}</p>
      <h1 ref={headingRef} tabIndex={-1}>{signingIn ? "Sign in to PastPaperPrep." : "Create your account."}</h1>
      <p>{signingIn
        ? "Your saved questions, filters, and progress are waiting."
        : "Save questions, track progress, and keep your revision in one place."}</p>

      {signingIn && hasLinkError && (
        <p className="form-message error auth-link-error" role="alert">
          That sign-in link is invalid or expired. Request a fresh one below.
        </p>
      )}

      {hasGoogleError && <p className="form-message error auth-link-error" role="alert">Google sign-in didn’t finish. Try again.</p>}

      <GoogleSignInButton next={next} />
      <div className="auth-divider"><span>or use email</span></div>

      {signingIn ? <SignInMethods next={next} /> : <PasswordSignUpForm next={next} />}

      <div className="auth-mode-switch" role="group" aria-label="Account options">
        <span>{signingIn ? "New here?" : "Already have an account?"}</span>
        <button type="button" onClick={() => setMode(signingIn ? "sign-up" : "sign-in")}>
          {signingIn ? "Create a free account" : "Sign in instead"}
        </button>
      </div>
    </>
  );
}
