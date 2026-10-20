"use client";

import { useState, useTransition } from "react";
import { claimPreferredSourceBonus } from "./actions";

export const PREFERRED_SOURCE_URL = "https://www.google.com/preferences/source?q=pastpaperprep.com";

export function PreferredSourceBonus({ claimed }: { claimed: boolean }) {
  const [done, setDone] = useState(claimed);
  const [, startTransition] = useTransition();
  if (done) {
    return <p className="account-referral-bonus is-done">Added on Google <span aria-hidden="true">·</span> +1 signup counted</p>;
  }
  return (
    <div className="account-referral-bonus-wrap">
    <a
      className="button secondary account-referral-bonus"
      href={PREFERRED_SOURCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => startTransition(async () => { if (await claimPreferredSourceBonus()) setDone(true); })}
    >
      Add us as a preferred source on Google <span aria-hidden="true">·</span> +1 signup
    </a>
    <span>On Google, search PastPaperPrep and tick the box.</span>
    </div>
  );
}
