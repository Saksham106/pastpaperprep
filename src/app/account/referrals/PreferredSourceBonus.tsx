"use client";

import { useState, useTransition } from "react";
import { GooglePreferredSourceButton } from "@/components/GooglePreferredSourceButton";
import { claimPreferredSourceBonus } from "./actions";

// Google's button renders in a shadow root, so its clicks bubble to our wrapper.
export function PreferredSourceBonus({ claimed }: { claimed: boolean }) {
  const [done, setDone] = useState(claimed);
  const [, startTransition] = useTransition();
  function claim() {
    if (done) return;
    startTransition(async () => { if (await claimPreferredSourceBonus()) setDone(true); });
  }
  return (
    <div className="account-referral-bonus-wrap">
      <div onClickCapture={claim} data-testid="preferred-source-button">
        <GooglePreferredSourceButton />
      </div>
      {done && <span>Added <span aria-hidden="true">·</span> +1 point counted</span>}
    </div>
  );
}
