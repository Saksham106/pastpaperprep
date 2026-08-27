"use client";

import { EnvelopeSimple, Key } from "@phosphor-icons/react";
import { useState } from "react";
import { MagicLinkForm } from "@/components/MagicLinkForm";
import { PasswordSignInForm } from "@/components/PasswordSignInForm";

type Method = "password" | "email";

export function SignInMethods({ next }: { next: string }) {
  const [method, setMethod] = useState<Method>("password");

  return (
    <div className="sign-in-methods">
      <div className="sign-in-tabs" role="tablist" aria-label="Sign-in method">
        <button type="button" role="tab" aria-selected={method === "password"} aria-controls="password-sign-in" onClick={() => setMethod("password")}><Key aria-hidden="true" /> Password</button>
        <button type="button" role="tab" aria-selected={method === "email"} aria-controls="email-link-sign-in" onClick={() => setMethod("email")}><EnvelopeSimple aria-hidden="true" /> Email link</button>
      </div>
      <div id={method === "password" ? "password-sign-in" : "email-link-sign-in"} role="tabpanel">
        {method === "password" ? <PasswordSignInForm next={next} /> : <MagicLinkForm next={next} />}
      </div>
    </div>
  );
}
