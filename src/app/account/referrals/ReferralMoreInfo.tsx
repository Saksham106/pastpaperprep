"use client";

import { useRef } from "react";

export function ReferralMoreInfo() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  function close() {
    dialogRef.current?.close();
    triggerRef.current?.focus();
  }
  return (
    <>
      <button ref={triggerRef} type="button" className="account-referral-more" onClick={() => dialogRef.current?.showModal()}>More info <span aria-hidden="true">↗</span></button>
      <dialog ref={dialogRef} className="account-referral-dialog" aria-labelledby="account-referral-dialog-title" onCancel={(event) => { event.preventDefault(); close(); }}>
        <button type="button" className="account-referral-dialog-close" aria-label="Close referral details" onClick={close}>×</button>
        <p className="eyebrow">Referral details</p>
        <h2 id="account-referral-dialog-title">How referral credits work</h2>
        <p>Share your link with someone new to PastPaperPrep. We count their signup only after they verify their account. Every five eligible verified signups can earn a credit.</p>
        <p>A referred person’s first paid subscription purchase can also earn a credit. We check purchases manually; they aren’t shown as a live counter.</p>
        <p>Each credit is worth one month of your paid plan and is added manually to a future bill after review. For annual plans, that’s one-twelfth of your annual price as a bill credit—not extra time on your subscription. If you’re on a free account, we review the credit when you choose an eligible paid plan.</p>
        <p>Self-referrals, existing accounts, refunded payments and $0 invoices don’t qualify. Credits aren’t cash.</p>
      </dialog>
    </>
  );
}
