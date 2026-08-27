"use client";

import { EnvelopeSimple, Key } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { MagicLinkForm } from "@/components/MagicLinkForm";
import { PasswordSignInForm } from "@/components/PasswordSignInForm";

type Method = "password" | "email";

export function SignInMethods({ next }: { next: string }) {
  const [method, setMethod] = useState<Method>("password");
  const passwordTab = useRef<HTMLButtonElement>(null);
  const emailTab = useRef<HTMLButtonElement>(null);

  const selectMethod = (nextMethod: Method, focus = false) => {
    setMethod(nextMethod);
    if (focus) {
      const target = nextMethod === "password" ? passwordTab : emailTab;
      window.requestAnimationFrame(() => target.current?.focus());
    }
  };

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextMethod = event.key === "Home"
      ? "password"
      : event.key === "End"
        ? "email"
        : method === "password" ? "email" : "password";
    selectMethod(nextMethod, true);
  };

  return (
    <div className="sign-in-methods">
      <div className="sign-in-tabs" role="tablist" aria-label="Sign-in method">
        <button ref={passwordTab} id="password-sign-in-tab" type="button" role="tab" tabIndex={method === "password" ? 0 : -1} aria-selected={method === "password"} aria-controls="password-sign-in" onKeyDown={handleTabKey} onClick={() => selectMethod("password")}><Key aria-hidden="true" /> Password</button>
        <button ref={emailTab} id="email-link-sign-in-tab" type="button" role="tab" tabIndex={method === "email" ? 0 : -1} aria-selected={method === "email"} aria-controls="email-link-sign-in" onKeyDown={handleTabKey} onClick={() => selectMethod("email")}><EnvelopeSimple aria-hidden="true" /> Email link</button>
      </div>
      <div id="password-sign-in" role="tabpanel" aria-labelledby="password-sign-in-tab" hidden={method !== "password"} inert={method !== "password" ? true : undefined}>
        {method === "password" && <PasswordSignInForm next={next} />}
      </div>
      <div id="email-link-sign-in" role="tabpanel" aria-labelledby="email-link-sign-in-tab" hidden={method !== "email"} inert={method !== "email" ? true : undefined}>
        {method === "email" && <MagicLinkForm next={next} />}
      </div>
    </div>
  );
}
