"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import type { PaymentFailedNotice as Notice } from "@/lib/payment-failed-notice";
import { trackProductEvent } from "@/lib/product-analytics";
import { accountIdFromCookieHeader, documentHasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";
import { createClient } from "@/lib/supabase/browser";
import styles from "./PaymentFailedNotice.module.css";

export type PaymentNoticePlacement = "dashboard" | "account" | "bank" | "pricing";
type EventPlacement = PaymentNoticePlacement | "checkout";

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

/** The signed-in account per the session cookie (decoded, not verified; the server authorizes every read). */
function currentAccount() {
  return accountIdFromCookieHeader(document.cookie);
}

/** A recent "nothing to pay" answer for this account, so healthy subscribers don't ask on every page. */
function recentlyClear(accountId: string | undefined) {
  if (!accountId) return false;
  const [id, until] = (read("sessionStorage", CLEAR_KEY) ?? "").split("|");
  return id === accountId && Number(until) > Date.now();
}

/** "Hide for today" covers one account's one bill, never another account's or a newer bill. */
function dismissalKey(accountId: string | undefined, invoiceId: string) {
  return `${accountId ?? ""}|${invoiceId}|${today()}`;
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
  // On pricing the student came to buy: say that paying is also the way to change plan.
  const plan = placement === "pricing";
  if (notice.accessEnded) return `${payment}, so your access has stopped. Pay now to restore it${plan ? " and change your plan" : ""}.`;
  if (ends) return `${payment}. Pay by ${ends} to keep access${plan ? " and change your plan" : ""}.`;
  // No date we can stand behind (a pause or a scheduled change): don't promise anything about access.
  return `${payment}. Pay now to keep your plan${plan ? " or change it" : ""}.`;
}

function trustedPortalUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "billing.stripe.com" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function defaultNavigate(url: string) { window.location.assign(url); }

/** Opens Stripe's billing portal; false when it couldn't (the caller shows the error). */
async function openBillingPortal(navigate: (url: string) => void) {
  try {
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const url = response.ok ? trustedPortalUrl((await response.json() as { url?: unknown })?.url) : null;
    if (!url) return false;
    navigate(url);
    return true;
  } catch {
    return false;
  }
}

type NoticeResponse = { ok: false } | { ok: true; notice: Notice | null; purchaseBlocked: boolean; invoicePaid: boolean };

async function fetchNotice(invoiceId?: string): Promise<NoticeResponse> {
  try {
    const url = invoiceId ? `/api/billing/payment-notice?invoice=${encodeURIComponent(invoiceId)}` : "/api/billing/payment-notice";
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return { ok: false };
    const body = await response.json() as { notice?: Notice | null; purchaseBlocked?: unknown; invoicePaid?: unknown };
    if (!body || typeof body !== "object" || typeof body.purchaseBlocked !== "boolean") return { ok: false };
    return { ok: true, notice: body.notice ?? null, purchaseBlocked: body.purchaseBlocked, invoicePaid: body.invoicePaid === true };
  } catch {
    return { ok: false };
  }
}

function track(name: "payment_failed_notice_view" | "payment_failed_notice_click", placement: EventPlacement, notice: Notice | null) {
  trackProductEvent(name, { placement, state: notice ? noticeState(notice) : "no_date", action: notice?.payUrl ? "pay" : "portal" });
}

/** Re-runs `onReturn` when the student comes back to this tab (after paying in another). */
function useOnReturn(onReturn: () => void) {
  useEffect(() => {
    function handle() { if (document.visibilityState !== "hidden") onReturn(); }
    window.addEventListener("focus", handle);
    document.addEventListener("visibilitychange", handle);
    return () => {
      window.removeEventListener("focus", handle);
      document.removeEventListener("visibilitychange", handle);
    };
  }, [onReturn]);
}

/** Calls `onChange` when the signed-in account changes in this tab (sign-out, or sign-in as someone else). */
function useAccountChange(onChange: () => void) {
  useEffect(() => {
    let last = currentAccount();
    let subscription: { unsubscribe(): void } | undefined;
    try {
      subscription = createClient().auth.onAuthStateChange((_event, session) => {
        const id = session?.user?.id?.toLowerCase();
        if (id === last) return;
        last = id;
        onChange();
      }).data.subscription;
    } catch { /* No auth client: account changes are still caught on return to the tab. */ }
    return () => subscription?.unsubscribe();
  }, [onChange]);
}

/**
 * Shown only to signed-in accounts whose latest renewal failed. Silent everywhere else:
 * nothing renders until the server confirms an unpaid renewal for the account signed in now.
 */
export function PaymentFailedNotice({ placement, className, navigate = defaultNavigate }: { placement: PaymentNoticePlacement; className?: string; navigate?: (url: string) => void }) {
  const [shown, setShown] = useState<{ notice: Notice; accountId: string | undefined } | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [portalError, setPortalError] = useState(false);
  const request = useRef(0);
  const viewed = useRef<string | null>(null);
  const awaitingPayment = useRef(false);

  const check = useCallback(async () => {
    // Latest request wins, and only for the account that asked: a slow answer never restores a stale bill.
    const id = ++request.current;
    const accountId = currentAccount();
    if (!documentHasSupabaseAuthCookie(document.cookie) || recentlyClear(accountId)) {
      setShown(null);
      return;
    }
    const result = await fetchNotice();
    if (id !== request.current || accountId !== currentAccount() || !result.ok) return; // Best effort.
    const next = result.notice;
    if (!next && accountId) write("sessionStorage", CLEAR_KEY, `${accountId}|${Date.now() + CLEAR_TTL_MS}`);
    if (next) write("sessionStorage", CLEAR_KEY, null);
    setShown(next && read("localStorage", DISMISS_KEY) !== dismissalKey(accountId, next.invoiceId) ? { notice: next, accountId } : null);
  }, []);

  const reset = useCallback(() => {
    request.current += 1; // Drops any answer still in flight for the previous account.
    awaitingPayment.current = false;
    setShown(null);
    setPortalError(false);
    void check();
  }, [check]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the network answer, once per mount
  useEffect(() => { void check(); }, [check]);
  useAccountChange(reset);
  // Back in this tab: another account may have signed in elsewhere, or the bill may now be paid.
  useOnReturn(useCallback(() => {
    if (shown && shown.accountId !== currentAccount()) reset();
    else if (awaitingPayment.current) void check();
  }, [shown, reset, check]));

  useEffect(() => {
    if (!shown) return;
    const key = `${shown.accountId ?? ""}|${shown.notice.invoiceId}`;
    if (viewed.current === key) return;
    viewed.current = key;
    track("payment_failed_notice_view", placement, shown.notice);
  }, [shown, placement]);

  if (!shown) return null;
  const { notice, accountId } = shown;
  const state = noticeState(notice);

  function clicked() {
    awaitingPayment.current = true;
    track("payment_failed_notice_click", placement, notice);
  }

  async function openPortal() {
    clicked();
    setPortalPending(true);
    setPortalError(false);
    if (!await openBillingPortal(navigate)) setPortalError(true);
    setPortalPending(false);
  }

  function dismiss() {
    write("localStorage", DISMISS_KEY, dismissalKey(accountId, notice.invoiceId));
    setShown(null);
  }

  return (
    <div className={[styles.slot, className].filter(Boolean).join(" ")} data-placement={placement}>
      <div className={styles.notice} role="status" data-state={state}>
        <p className={styles.message}>
          {noticeCopy(notice, placement)}
          {portalError ? <span className={styles.error}> The billing portal didn&apos;t open. Try again or email hello@pastpaperprep.com.</span> : null}
        </p>
        {notice.payUrl
          ? <a className={`button primary ${styles.action}`} href={notice.payUrl} target="_blank" rel="noopener noreferrer" onClick={clicked}>Pay now</a>
          : <button className={`button primary ${styles.action}`} type="button" disabled={portalPending} onClick={openPortal}>Update payment method</button>}
        <button className={styles.dismiss} type="button" aria-label="Hide for today" onClick={dismiss}><X weight="bold" aria-hidden="true" /></button>
      </div>
    </div>
  );
}

type StepState =
  | { kind: "loading" }
  | { kind: "ready"; notice: Notice | null }
  | { kind: "paid" };

/**
 * The one step in a checkout that a failed renewal blocks: pay that bill. Opens Stripe's hosted
 * invoice, or the billing portal when Stripe gives no invoice link (for example a first payment
 * that never completed). Each click binds verification to the bill on show at that moment; on
 * return the server must confirm that exact bill is paid and that checkout would no longer refuse
 * before this says so and calls `onResolved` (so the parent re-checks its own eligibility).
 * Without that proof nothing is announced and the step stays.
 */
export function PayFailedRenewalButton({ navigate = defaultNavigate, onResolved }: { navigate?: (url: string) => void; onResolved?: () => void }) {
  const [state, setState] = useState<StepState>({ kind: "loading" });
  const [portalPending, setPortalPending] = useState(false);
  const [portalError, setPortalError] = useState(false);
  const request = useRef(0);
  /** The bill whose button was clicked last, and for which account; the only bill a return check may prove. */
  const clickedBill = useRef<{ invoiceId: string | null; accountId: string | undefined } | null>(null);
  const resolved = useRef(onResolved);
  useEffect(() => { resolved.current = onResolved; }, [onResolved]);

  const check = useCallback(async () => {
    const id = ++request.current;
    const accountId = currentAccount();
    const bill = clickedBill.current?.accountId === accountId ? clickedBill.current : null;
    const invoiceId = bill?.invoiceId ?? undefined;
    const result = await fetchNotice(invoiceId);
    // Stale: a newer check started, the account changed, or a newer click rebound the proof.
    if (id !== request.current || accountId !== currentAccount() || clickedBill.current !== bill) return;
    if (!result.ok) {
      // A failed first check falls back to the portal; a failed re-check keeps the verified link.
      setState((current) => current.kind === "loading" ? { kind: "ready", notice: null } : current);
      return;
    }
    const proven = Boolean(invoiceId) && result.invoicePaid;
    if (proven && !result.purchaseBlocked) {
      setState({ kind: "paid" });
      resolved.current?.();
      return;
    }
    // That bill is paid but something else still blocks: its proof is spent; the next bill needs its own click.
    if (proven) clickedBill.current = null;
    setState((current) => {
      // Keep the link we had unless the server proved that bill paid (then the next blocker, or the portal).
      const kept = current.kind === "ready" && !proven ? current.notice : null;
      const notice = result.notice ?? kept;
      if (current.kind === "loading") track("payment_failed_notice_view", "checkout", notice);
      return { kind: "ready", notice };
    });
  }, []);

  const reset = useCallback(() => {
    request.current += 1;
    clickedBill.current = null;
    setState({ kind: "loading" });
    void check();
  }, [check]);

  useEffect(() => { void check(); }, [check]);
  useAccountChange(reset);
  useOnReturn(useCallback(() => {
    const bill = clickedBill.current;
    if (!bill) return;
    if (bill.accountId !== currentAccount()) reset();
    else void check();
  }, [reset, check]));

  if (state.kind === "paid") return <p className={styles.paid} role="status">Payment received. You can continue now.</p>;
  const notice = state.kind === "ready" ? state.notice : null;

  function clicked() {
    // Rebind verification to this bill; any earlier proof (and any check still in flight for it) no longer counts.
    clickedBill.current = { invoiceId: notice?.invoiceId ?? null, accountId: currentAccount() };
    request.current += 1;
    track("payment_failed_notice_click", "checkout", notice);
  }

  async function openPortal() {
    clicked();
    setPortalPending(true);
    setPortalError(false);
    if (!await openBillingPortal(navigate)) setPortalError(true);
    setPortalPending(false);
  }

  return <>
    {notice?.payUrl
      ? <a className="button primary" href={notice.payUrl} target="_blank" rel="noopener noreferrer" onClick={clicked}>Pay now</a>
      : <button className="button primary" type="button" disabled={state.kind === "loading" || portalPending} onClick={openPortal}>{state.kind === "loading" ? "Pay now" : "Update payment method"}</button>}
    {portalError ? <p className={styles.error} role="alert">The billing portal didn&apos;t open. Try again or email hello@pastpaperprep.com.</p> : null}
  </>;
}
