"use client";

import { useState } from "react";

export function CopyReferralLink({ url }: { url: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Copied");
    } catch {
      setStatus("Select and copy the link above");
    }
  }
  return (
    <div className="account-referral-link">
      <label htmlFor="referral-share-link">Your referral link</label>
      <div className="account-referral-link-controls">
        <input id="referral-share-link" type="text" value={url} readOnly onFocus={(event) => event.currentTarget.select()} />
        <button className="button secondary" type="button" onClick={copy}>Copy link</button>
      </div>
      <span role="status" aria-live="polite">{status}</span>
    </div>
  );
}
