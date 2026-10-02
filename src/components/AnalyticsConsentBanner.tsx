"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Cookie, X } from "@phosphor-icons/react/dist/ssr";
import styles from "./AnalyticsConsentBanner.module.css";

export function AnalyticsConsentBanner({ onChoice, onDismiss, initialAnalytics = false, busy = false, error = false }: {
  onChoice: (analyticsAccepted: boolean) => void;
  onDismiss: () => void;
  initialAnalytics?: boolean;
  busy?: boolean;
  error?: boolean;
}) {
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const id = useId();
  const analyticsInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customizing) analyticsInput.current?.focus({ preventScroll: true });
  }, [customizing]);

  return (
    <aside className={styles.banner} aria-labelledby={`${id}-title`}>
      <button className={styles.close} type="button" aria-label="Close cookie banner" onClick={() => onDismiss()}><X size={12} weight="bold" aria-hidden="true" /></button>
      <div className={styles.heading}>
        <span className={styles.mark} aria-hidden="true"><Cookie size={22} weight="duotone" /></span>
        <h2 id={`${id}-title`}>A little cookie housekeeping.</h2>
      </div>
      <p className={styles.copy}>Optional analytics cookies help us see what works and make practice smoother. Signed in? We link that usage to your account.{!customizing && <>{" "}<button className={styles.customize} type="button" aria-expanded={false} aria-controls={`${id}-preferences`} onClick={() => setCustomizing(true)}>Customize</button></>}</p>
      {customizing && <div id={`${id}-preferences`} className={styles.preferences}>
        <div className={styles.preference}><div><strong>Essential cookies</strong><p>Keep sign-in and your preferences working.</p></div><span className={styles.always}>Always on</span></div>
        <label className={styles.preference}><div><strong>Optional analytics</strong><p id={`${id}-analytics-description`}>Usage, performance and account-linked insights. No session recording.</p></div><input ref={analyticsInput} type="checkbox" aria-label="Optional analytics" aria-describedby={`${id}-analytics-description`} checked={analytics} onChange={event => setAnalytics(event.target.checked)} /></label>
      </div>}
      {error && <p role="alert" className={styles.copy}>We couldn’t save your choice. Please try again.</p>}
      <div className={`${styles.actions} ${customizing ? styles.expanded : ""}`}>
        {customizing && <button className={styles.reject} type="button" disabled={busy} onClick={() => onChoice(false)}>Reject</button>}
        {customizing && <button className={styles.save} type="button" disabled={busy} onClick={() => onChoice(analytics)}>{busy ? "Saving…" : "Save preferences"}</button>}
        <button className={styles.accept} type="button" disabled={busy} onClick={() => onChoice(true)}>{busy ? "Saving…" : "Sure, allow cookies"}</button>
      </div>
      <div className={styles.footnote}><span>Change your choice anytime.</span><a href="/privacy">Privacy policy <span aria-hidden="true">↗</span></a></div>
    </aside>
  );
}
