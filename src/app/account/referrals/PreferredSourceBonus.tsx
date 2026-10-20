"use client";

import Script from "next/script";
import { useEffect, useState, useTransition } from "react";
import { claimPreferredSourceBonus } from "./actions";

// Google's official button; it renders in a shadow root, so its clicks bubble to our wrapper.
export const PREFERRED_SOURCE_SCRIPT = "https://news.google.com/swg/js/v1/publisher.js";

type PreferredSourceApi = { init(options: { lang?: string }): void };
declare global { interface Window { PREFERRED_SOURCE?: Array<(api: PreferredSourceApi) => void> | { push(fn: (api: PreferredSourceApi) => void): void } } }

export function PreferredSourceBonus({ claimed }: { claimed: boolean }) {
  const [done, setDone] = useState(claimed);
  const [, startTransition] = useTransition();
  // The script only scans for buttons when it initialises, so re-run it after client-side navigation.
  useEffect(() => {
    (window.PREFERRED_SOURCE ??= []).push((api) => api.init({ lang: "en" }));
  }, []);
  function claim() {
    if (done) return;
    startTransition(async () => { if (await claimPreferredSourceBonus()) setDone(true); });
  }
  return (
    <div className="account-referral-bonus-wrap">
      <Script src={PREFERRED_SOURCE_SCRIPT} strategy="afterInteractive" preferred-sources-control="manual" />
      <div onClickCapture={claim} data-testid="preferred-source-button">
        <div google-add-preferred-source-btn="" />
      </div>
      <span>{done ? "+1 signup counted" : "Counts as 1 signup"}</span>
    </div>
  );
}
