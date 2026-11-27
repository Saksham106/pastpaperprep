"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import type { PaymentFailedNotice as Notice } from "@/lib/payment-failed-notice";
import { trackProductEvent } from "@/lib/product-analytics";
import { accountIdFromCookieHeader, documentHasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";
import styles from "./PaymentFailedNotice.module.css";

export type PaymentNoticePlacement = "dashboard" | "account" | "bank" | "pricing";

const DISMISS_KEY = "ppp:payment-notice-dismissed";
const CLEAR_KEY = "ppp:payment-notice-clear";
const CLEAR_TTL_MS = 15 * 60 * 1000;

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function read(storage: "localStorage" | "sessionStorage", key: string) {
  try { return window[storage].getItem(key); } catch { return null; }
}

function write(storage: "localStorage" | "sessionStorage", key: string, value: string | null) {
  try {
    if (value === null) window[storage].removeItem(key);
    else window[storage].setItem(key, value);
  } catch { /* Storage blocked: the notice simply shows again. */ }
}

/** A recent "nothing to pay" answer for this account, so healthy subscribers don't ask on every page. */
function recentlyClear(accountId: string | undefined) {
  if (!accountId) return false;
  const [id, until] = (read("sessionStorage", CLEAR_KEY) ?? "").split("|");
  return id === accountId && Number(until) > Date.now();
}

function money(cents: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100); } catch { return null; }
}

function shortDate(iso: string) {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date) : null;
}

export function noticeState(notice: Notice): "grace" | "ended" | "no_date" {
  return notice.accessEnded ? "ended" : notice.accessEndsAt ? "grace" : "no_date";
}

export function noticeCopy(notice: Notice, placement: PaymentNoticePlacement) {
  const amount = money(notice.amountCents, notice.currency);
  const payment = amount ? `Your latest renewal payment of ${amount} didn't go through` : "Your latest renewal payment didn't go through";
  const ends = notice.accessEndsAt ? shortDate(notice.accessEndsAt) : null;
  const ask = notice.accessEnded
    ? `${payment}, so your access has stopped. Pay now to restore it.`
    : ends ? `${payment}. Pay by ${ends} to keep access.` : `${payment}. Pay now to keep access.`;
  return placement === "pricing" ? `${ask} New plans unlock once it's paid.` : ask;
}

function trustedPortalUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "billing.stripe.com" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function defaultNavigate(url: string) { window.location.assign(url); }

/**
 * Shown only to signed-in accounts whose latest renewal failed. Silent everywhere else:
 * nothing renders until the server confirms an unpaid renewal.
 */
export function PaymentFailedNotice({ placement, className, navigate = defaultNavigate }: { placement: PaymentNoticePlacement; className?: string; navigate?: (url: string) => void }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [portalError, setPortalError] = useState(false);
  const viewed = useRef(false);
  const awaitingPayment = useRef(false);

  const check = useCallback(async () => {
    if (!documentHasSupabaseAuthCookie(document.cookie) || read("localStorage", DISMISS_KEY) === today()) return;
    const accountId = accountIdFromCookieHeader(document.cookie);
    if (recentlyClear(accountId)) return;
    try {
      const response = await fetch("/api/billing/payment-notice", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json() as { notice?: Notice | null };
      const next = body?.notice ?? null;
      setNotice(next);
      if (!next && accountId) write("sessionStorage", CLEAR_KEY, `${accountId}|${Date.now() + CLEAR_TTL_MS}`);
      if (next) write("sessionStorage", CLEAR_KEY, null);
    } catch { /* Best effort: no notice when the check can't run. */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the network answer, once per mount
  useEffect(() => { void check(); }, [check]);

  // After "Pay now" opens Stripe in another tab, re-check on return so a paid bill clears at once.
  useEffect(() => {
    function onReturn() {
      if (!awaitingPayment.current || document.visibilityState === "hidden") return;
      void check();
    }
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [check]);

  useEffect(() => {
    if (!notice || viewed.current) return;
    viewed.current = true;
    trackProductEvent("payment_failed_notice_view", { placement, state: noticeState(notice), action: notice.payUrl ? "pay" : "portal" });
  }, [notice, placement]);

  if (!notice) return null;
  const state = noticeState(notice);

  function clicked(action: "pay" | "portal") {
    awaitingPayment.current = true;
    trackProductEvent("payment_failed_notice_click", { placement, state, action });
  }

  async function openPortal() {
    clicked("portal");
    setPortalPending(true);
    setPortalError(false);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const url = response.ok ? trustedPortalUrl((await response.json() as { url?: unknown })?.url) : null;
      if (!url) throw new Error("portal");
      navigate(url);
    } catch {
      setPortalError(true);
    } finally {
      setPortalPending(false);
    }
  }

  function dismiss() {
    write("localStorage", DISMISS_KEY, today());
    setNotice(null);
  }

  return (
    <div className={[styles.slot, className].filter(Boolean).join(" ")} data-placement={placement}>
      <div className={styles.notice} role="status" data-state={state}>
        <p className={styles.message}>
          {noticeCopy(notice, placement)}
          {portalError ? <span className={styles.error}> The billing portal didn&apos;t open. Try again or email hello@pastpaperprep.com.</span> : null}
        </p>
        {notice.payUrl
          ? <a className={`button primary ${styles.action}`} href={notice.payUrl} target="_blank" rel="noopener noreferrer" onClick={() => clicked("pay")}>Pay now</a>
          : <button className={`button primary ${styles.action}`} type="button" disabled={portalPending} onClick={openPortal}>Update payment method</button>}
        <button className={styles.dismiss} type="button" aria-label="Hide for today" onClick={dismiss}><X weight="bold" aria-hidden="true" /></button>
      </div>
    </div>
  );
}
