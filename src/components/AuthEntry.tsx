"use client";

import { useState } from "react";
import { PasswordSignUpForm } from "@/components/PasswordSignUpForm";
import { SignInMethods } from "@/components/SignInMethods";

type AuthMode = "sign-in" | "sign-up";

export function AuthEntry({ next, hasLinkError = false }: { next: string; hasLinkError?: boolean }) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const signingIn = mode === "sign-in";

  return (
    <>
      <p className="eyebrow">{signingIn ? "Your study space" : "Start studying"}</p>
      <h1>{signingIn ? "Sign in to PastPaperPrep." : "Create your account."}</h1>
      <p>{signingIn
        ? "Your saved questions, filters, and progress are waiting."
        : "Save questions, track progress, and keep your revision in one place."}</p>

      {signingIn && hasLinkError && (
        <p className="form-message error auth-link-error" role="alert">
          That sign-in link is invalid or expired. Request a fresh one below.
        </p>
      )}

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
