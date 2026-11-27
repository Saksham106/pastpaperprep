"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarBlank, CheckCircle, Pause, Sparkle, Stack, Tag } from "@phosphor-icons/react";
import { formatPrice, priceForBankCount } from "@/lib/pricing-model";
import { trackProductEvent } from "@/lib/product-analytics";
import { CANCEL_COMMENT_MAX_LENGTH, CANCEL_REASONS, isCancelReason, type CancelReason, type RetentionDecision, type RetentionOffer } from "@/lib/retention-offer";
import { PAUSE_MONTH_OPTIONS, type PauseMonths, type PauseState } from "@/lib/subscription-pause";
import styles from "./SubscriptionExitFlow.module.css";

/**
 * Cancel / pause flow on its own page (/subscription/cancel, /subscription/pause).
 * Steps: reason (optional) → one offer, always with pause and "Continue to cancel" → confirm → done.
 * "Keep my subscription" is the primary action on every step; cancelling stays one clear click away.
 */

type Selection = { kind: "all" } | { kind: "selected"; banks: { slug: string; name: string }[] } | { kind: "unknown" };
type LoadedSubscription = {
  id: string; status: string; cancelAtPeriodEnd: boolean; pause?: PauseState; bankSelection: Selection;
  /** Server-computed from the billing anchor; null when the plan can't pause. */
  pauseResumeDates?: Partial<Record<PauseMonths, string>> | null;
  items: { recurringSubtotalCents: number | null; price: { currency: string; interval: string | null }; currentPeriodEnd: string | null }[];
};
type Step = "loading" | "unavailable" | "reason" | "offer" | "confirm" | "cancelled" | "pause" | "paused";
const REASON_LABELS: Record<CancelReason, string> = {
  too_expensive: "It’s too expensive",
  not_studying: "Exams finished, or not studying now",
  missing_subject: "My subject isn’t here",
  switched_service: "I’m switching to another service",
  other: "Something else",
};
const OFFER_KINDS = new Set<unknown>(["discount", "fewer_banks", "updates"]);
const validOffer = (offer: unknown): offer is RetentionOffer | null => offer === null ||
  typeof offer === "object" && offer !== null && OFFER_KINDS.has((offer as { kind?: unknown }).kind) &&
  ((offer as { kind: string }).kind !== "discount" || Number.isSafeInteger((offer as { percentOff?: unknown }).percentOff));
const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(parsed) : null;
};
const money = (cents: number | null | undefined) => typeof cents === "number" && Number.isSafeInteger(cents) && cents >= 0
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100) : null;

/** The offer is optional: a slow lookup must never hold the student back from cancelling. */
export const OFFER_TIMEOUT_MS = 4000;

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store", signal });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Billing is temporarily unavailable. Nothing has been changed.");
  return result;
}

/** Where a student came from to this flow: the access-end email or the on-site "plan ends" strip. */
export type ExitFlowSource = "reminder" | "notice";

export function SubscriptionExitFlow({ start, source }: { start: "cancel" | "pause"; source?: ExitFlowSource }) {
  const [step, setStep] = useState<Step>("loading");
  const [sub, setSub] = useState<LoadedSubscription | null>(null);
  const [pauseEnabled, setPauseEnabled] = useState(false);
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState<(RetentionDecision & { pauseAvailable: boolean }) | null>(null);
  const [months, setMonths] = useState<PauseMonths>(1);
  const [result, setResult] = useState<{ accessUntil?: string; resumesAt?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 10_000);
    void (async () => {
      try {
        const response = await fetch("/api/billing/subscription", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!response.ok) { setStep("unavailable"); return; }
        const data = await response.json() as { subscriptions?: LoadedSubscription[]; management?: { editable?: boolean; pauseEnabled?: boolean } };
        const current = (data.subscriptions ?? []).filter((s) => s.status === "active");
        if (current.length !== 1 || data.management?.editable !== true || current[0].items?.length !== 1) { setStep("unavailable"); return; }
        const loaded = current[0];
        const canPause = data.management.pauseEnabled === true && loaded.items[0].price.interval === "month";
        setSub(loaded); setPauseEnabled(canPause);
        if (loaded.cancelAtPeriodEnd) setStep("cancelled");
        else if (loaded.pause && loaded.pause.kind !== "none") { setResult({ accessUntil: loaded.pause.accessUntil, resumesAt: loaded.pause.resumesAt }); setStep("paused"); }
        else setStep(start === "pause" && canPause ? "pause" : "reason");
        trackProductEvent(start === "pause" ? "pause_flow_started" : "cancel_flow_started", {});
      } catch { if (timedOut || !controller.signal.aborted) setStep("unavailable"); }
      finally { clearTimeout(timer); }
    })();
    return () => { clearTimeout(timer); controller.abort(); };
  }, [start]);
  // Move focus to the new step's heading so screen readers and keyboards follow the flow.
  // Each step starts at the top (on phones the previous tap is far down the page).
  useEffect(() => {
    if (step === "loading") return;
    if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  const item = sub?.items[0] ?? null;
  const periodEnd = item?.currentPeriodEnd ?? null;
  const monthly = item?.price.interval === "month";
  const price = money(item?.recurringSubtotalCents);
  const priceLabel = price ? `${price}/${monthly ? "month" : "year"}` : null;
  const planName = !sub ? "" : sub.bankSelection.kind === "all" ? "All Access" : sub.bankSelection.kind === "selected" ? sub.bankSelection.banks.length === 1 ? "One Bank" : "Build Your Plan" : "Your plan";
  const bankLine = !sub ? "" : sub.bankSelection.kind === "all" ? "Every question bank" : sub.bankSelection.kind === "selected" ? sub.bankSelection.banks.map((bank) => bank.name).join(" · ") : "";
  const accessUntil = formatDate(periodEnd);
  const resumeDate = (m: PauseMonths) => formatDate(sub?.pauseResumeDates?.[m] ?? null);
  const offer = decision?.offer ?? null;
  const bankCount = sub?.bankSelection.kind === "selected" ? sub.bankSelection.banks.length : null;
  const discountedPrice = offer?.kind === "discount" && typeof item?.recurringSubtotalCents === "number" ? money(Math.round(item.recurringSubtotalCents * (100 - offer.percentOff) / 100)) : null;
  const oneBankPrice = monthly ? `${formatPrice(priceForBankCount("monthly", 1))}/month` : `${formatPrice(priceForBankCount("annual", 1))}/year`;
  const showPause = pauseEnabled && (decision ? decision.pauseAvailable : true);

  function go(next: Step) { setError(""); setStep(next); }

  async function continueFromReason() {
    if (busy) return;
    setBusy(true); setError("");
    let next: Step = "confirm";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OFFER_TIMEOUT_MS);
    try {
      const response = await post("/api/billing/subscription/cancellation", { intent: "offer", reason }, controller.signal);
      const basis = response.basis;
      if (validOffer(response.offer) && validOffer(response.eligibleOffer) && typeof response.holdout === "boolean" && typeof response.predicted === "boolean" && isCancelReason(basis)) {
        const loaded = { offer: response.offer, eligibleOffer: response.eligibleOffer, basis, predicted: response.predicted, holdout: response.holdout, pauseAvailable: response.pauseAvailable === true } as RetentionDecision & { pauseAvailable: boolean };
        setDecision(loaded);
        trackProductEvent("cancel_flow_offer_decision", { reason: reason ?? "none", basis: loaded.basis, predicted: loaded.predicted, holdout: loaded.holdout, offer: loaded.offer?.kind ?? "none", eligible_offer: loaded.eligibleOffer?.kind ?? "none", pause_available: loaded.pauseAvailable });
        if (loaded.offer || (pauseEnabled && loaded.pauseAvailable)) next = "offer";
      }
    } catch { /* Failed or timed out: never block cancelling, go straight to confirm. */ }
    finally { clearTimeout(timer); setBusy(false); go(next); }
  }

  async function acceptDiscount() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await post("/api/billing/subscription/cancellation", { intent: "accept_discount" });
      if (response.status !== "discount_applied" || typeof response.percentOff !== "number") throw new Error("Could not verify the discount. Check Billing before trying again.");
      trackProductEvent("cancel_flow_offer_accepted", { offer: "discount", reason: reason ?? "none" });
      setResult({ message: `${response.percentOff}% off your next payment. Your plan stays exactly as it is.` });
      go("cancelled"); setSub((current) => current && { ...current, cancelAtPeriodEnd: false });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not apply the discount."); }
    finally { setBusy(false); }
  }

  async function confirmCancel() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const body: Record<string, unknown> = { intent: "cancel" };
      if (reason) body.reason = reason;
      if (reason === "other" && comment.trim()) body.comment = comment.trim().slice(0, CANCEL_COMMENT_MAX_LENGTH);
      const response = await post("/api/billing/subscription/cancellation", body);
      if (response.cancelAtPeriodEnd !== true || !formatDate(typeof response.effectiveAt === "string" ? response.effectiveAt : null)) throw new Error("Could not verify the cancellation. Check Billing before trying again.");
      trackProductEvent("cancel_flow_cancelled", { reason: reason ?? "none", offer: decision?.offer?.kind ?? "none", holdout: decision?.holdout ?? null, pause_shown: Boolean(decision?.pauseAvailable && pauseEnabled) });
      setSub((current) => current && { ...current, cancelAtPeriodEnd: true });
      setResult({ accessUntil: response.effectiveAt as string }); go("cancelled");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not cancel. Nothing has been changed."); }
    finally { setBusy(false); }
  }

  async function undoCancel() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await post("/api/billing/subscription/cancellation", { intent: "undo" });
      if (response.cancelAtPeriodEnd !== false) throw new Error("Could not verify the undo. Check Billing before trying again.");
      setSub((current) => current && { ...current, cancelAtPeriodEnd: false });
      setResult({ message: "You’re staying. Your plan renews as normal." });
      trackProductEvent("cancel_undone", { source: source ?? "account" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not undo. Nothing has been changed."); }
    finally { setBusy(false); }
  }

  async function confirmPause() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await post("/api/billing/subscription/pause", { intent: "pause", months });
      if (response.status !== "pause_scheduled" || !formatDate(typeof response.accessUntil === "string" ? response.accessUntil : null) || !formatDate(typeof response.resumesAt === "string" ? response.resumesAt : null)) throw new Error("Could not verify the pause. Check Billing before trying again.");
      trackProductEvent("pause_started", { months, source: start === "pause" && !decision ? "account" : "cancel_flow", reason: reason ?? "none" });
      setResult({ accessUntil: response.accessUntil as string, resumesAt: response.resumesAt as string }); go("paused");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not pause. Nothing has been changed."); }
    finally { setBusy(false); }
  }

  const back = <Link className={styles.back} href="/account/billing#subscription"><ArrowLeft aria-hidden="true" weight="bold" /> Subscription &amp; billing</Link>;
  const keep = (label = "Keep my subscription") => <Link className={styles.primary} href="/account/billing#subscription" onClick={() => trackProductEvent("cancel_flow_kept", { step, reason: reason ?? "none" })}>{label}</Link>;
  const recap = sub && item ? <div className={styles.recap}>
    <div><p className={styles.recapName}>{planName}</p>{bankLine ? <p className={styles.recapBanks}>{bankLine}</p> : null}</div>
    <div className={styles.recapBilling}>{priceLabel ? <p>{priceLabel}</p> : null}{accessUntil ? <p className={styles.muted}>Renews {accessUntil}</p> : null}</div>
  </div> : null;
  const stepLabel = (n: number) => <p className={styles.step}>Step {n} of 3</p>;
  const errorBox = error ? <p role="alert" className={styles.error}>{error}</p> : null;
  const pauseCard = <div className={styles.card}>
    <span className={styles.cardIcon} aria-hidden="true"><Pause weight="duotone" /></span>
    <div className={styles.cardBody}><h2>Need a break?</h2><p>Pause for 1 to 3 months. No charges, resume any time.</p></div>
    <button type="button" className={styles.secondarySmall} onClick={() => go("pause")}>Pause</button>
  </div>;

  return <main className={styles.page}>
    <div className={styles.shell}>
      {back}
      {step === "loading" ? <p className={styles.muted} role="status">Loading your plan…</p> : null}

      {step === "unavailable" ? <>
        <h1 ref={heading} tabIndex={-1}>We can’t change this plan here</h1>
        <p className={styles.lede}>You can still cancel in the secure billing portal under Subscription &amp; billing, or email <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a> and we’ll sort it out.</p>
        <div className={styles.actions}><Link className={styles.primary} href="/account/billing#subscription">Back to your account</Link></div>
      </> : null}

      {step === "reason" ? <>
        {stepLabel(1)}
        <h1 ref={heading} tabIndex={-1}>Why are you thinking of leaving?</h1>
        <p className={styles.lede}>Optional, but it helps us improve.</p>
        {recap}
        <fieldset className={styles.reasons}>
          <legend className="sr-only">Reason for cancelling (optional)</legend>
          {CANCEL_REASONS.map((value) => <label key={value} className={styles.reason} data-selected={reason === value || undefined}>
            <input type="radio" name="cancel-reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
            <span>{REASON_LABELS[value]}</span>
          </label>)}
        </fieldset>
        {reason === "other" ? <label className={styles.comment}>
          <span>Tell us more <span className={styles.muted}>(optional)</span></span>
          <textarea value={comment} maxLength={CANCEL_COMMENT_MAX_LENGTH} rows={3} onChange={(event) => setComment(event.target.value)} placeholder="What would have made you stay?" />
        </label> : null}
        {pauseEnabled ? pauseCard : null}
        <div className={styles.actions}>{keep()}<button type="button" className={styles.secondary} onClick={() => void continueFromReason()} disabled={busy}>{busy ? "One moment…" : "Continue"}</button></div>
      </> : null}

      {step === "offer" ? <>
        {stepLabel(2)}
        <h1 ref={heading} tabIndex={-1}>{offer?.kind === "discount" ? "Stay for less" : offer?.kind === "fewer_banks" ? "Keep just what you need" : offer?.kind === "updates" ? "More subjects are coming" : "Take a break instead"}</h1>
        {offer ? null : <p className={styles.lede}>Your plan and saved work stay ready for when you’re back.</p>}
        {errorBox}
        {offer?.kind === "discount" ? <div className={`${styles.card} ${styles.featured}`}>
          <span className={styles.cardIcon} aria-hidden="true"><Tag weight="duotone" /></span>
          <div className={styles.cardBody}><h2>{offer.percentOff}% off your next month</h2><p>{discountedPrice && price ? `Your next payment: ${discountedPrice} instead of ${price}.` : `${offer.percentOff}% off your next payment.`} Same plan.</p></div>
          <button type="button" className={styles.primarySmall} onClick={() => void acceptDiscount()} disabled={busy}>{busy ? "Applying…" : `Take ${offer.percentOff}% off`}</button>
        </div> : null}
        {offer?.kind === "fewer_banks" ? <div className={`${styles.card} ${styles.featured}`}>
          <span className={styles.cardIcon} aria-hidden="true"><Stack weight="duotone" /></span>
          <div className={styles.cardBody}><h2>Keep fewer banks</h2><p>{bankCount ? `You have ${bankCount} banks.` : "You have every bank."} Keep only the ones you still use, from {oneBankPrice}.</p></div>
          <Link className={styles.primarySmall} href="/pricing" onClick={() => trackProductEvent("cancel_flow_offer_accepted", { offer: "fewer_banks", reason: reason ?? "none" })}>Choose banks</Link>
        </div> : null}
        {offer?.kind === "updates" ? <div className={`${styles.card} ${styles.featured}`}>
          <span className={styles.cardIcon} aria-hidden="true"><Sparkle weight="duotone" /></span>
          <div className={styles.cardBody}><h2>Tell us what you need</h2><p>We add subjects often. Email <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a> with yours.</p></div>
          <Link className={styles.primarySmall} href="/updates" onClick={() => trackProductEvent("cancel_flow_offer_accepted", { offer: "updates", reason: reason ?? "none" })}>See updates</Link>
        </div> : null}
        {showPause ? offer ? pauseCard : <div className={`${styles.card} ${styles.featured}`}>
          <span className={styles.cardIcon} aria-hidden="true"><Pause weight="duotone" /></span>
          <div className={styles.cardBody}><h2>Pause for 1 to 3 months</h2><p>No charges while paused. Resume any time.</p></div>
          <button type="button" className={styles.primarySmall} onClick={() => go("pause")}>Pause instead</button>
        </div> : null}
        <div className={styles.actions}>{keep()}<button type="button" className={styles.secondary} onClick={() => go("confirm")} disabled={busy}>Continue to cancel</button></div>
      </> : null}

      {step === "confirm" ? <>
        {stepLabel(3)}
        <h1 ref={heading} tabIndex={-1}>Cancel your subscription?</h1>
        <p className={styles.lede}>{sub?.pause?.kind === "paused" ? `Your plan won’t restart on ${formatDate(sub.pause.resumesAt) ?? "the resume date"}. Your saved worksheets stay in your account.` : `You keep access until ${accessUntil ?? "the end of your paid period"}. Your saved worksheets stay in your account.`}</p>
        {recap}
        {errorBox}
        <div className={styles.actions}>{keep()}<button type="button" className={styles.secondary} onClick={() => void confirmCancel()} disabled={busy}>{busy ? "Cancelling…" : "Cancel subscription"}</button></div>
        {showPause ? <p className={styles.aside}>Just need a break? <button type="button" className={styles.inlineLink} onClick={() => go("pause")}>Pause instead</button></p> : null}
      </> : null}

      {step === "cancelled" && sub ? <>
        <span className={styles.doneIcon} aria-hidden="true"><CheckCircle weight="duotone" /></span>
        <h1 ref={heading} tabIndex={-1}>{sub.cancelAtPeriodEnd ? "Your subscription is cancelled" : "You’re all set"}</h1>
        <p className={styles.lede}>{sub.cancelAtPeriodEnd ? sub.pause?.kind === "paused" ? "Your plan won’t restart after your break. Changed your mind? Undo it from here." : `You keep access until ${formatDate(result.accessUntil ?? periodEnd) ?? "the end of your paid period"}. Changed your mind? Undo it before then.` : result.message ?? "Your plan renews as normal."}</p>
        {errorBox}
        <div className={styles.actions}>{sub.cancelAtPeriodEnd ? <><button type="button" className={styles.primaryButton} onClick={() => void undoCancel()} disabled={busy}>{busy ? "Undoing…" : "Undo cancellation"}</button><Link className={styles.secondary} href="/account/billing#subscription">Back to your account</Link></> : <Link className={styles.primary} href="/dashboard">Back to studying</Link>}</div>
      </> : null}

      {step === "pause" ? <>
        <h1 ref={heading} tabIndex={-1}>Pause your subscription</h1>
        <p className={styles.lede}>Your banks stay open until {accessUntil ?? "your renewal date"}. No charges while paused.</p>
        {recap}
        <fieldset className={styles.months}>
          <legend className="sr-only">How long to pause</legend>
          {PAUSE_MONTH_OPTIONS.map((m) => <label key={m} className={styles.month} data-selected={months === m || undefined}>
            <input type="radio" name="pause-months" value={m} checked={months === m} onChange={() => setMonths(m)} />
            <span className={styles.monthLength}>{m} {m === 1 ? "month" : "months"}</span>
            <span className={styles.monthDate}><CalendarBlank aria-hidden="true" /> Back {resumeDate(m) ?? "automatically"}</span>
          </label>)}
        </fieldset>
        <p className={styles.note}>Restarts {resumeDate(months) ?? "automatically"}{priceLabel ? ` at ${priceLabel}` : ""}. Resume earlier any time.</p>
        {errorBox}
        <div className={styles.actions}><button type="button" className={styles.primaryButton} onClick={() => void confirmPause()} disabled={busy}>{busy ? "Pausing…" : `Pause for ${months} ${months === 1 ? "month" : "months"}`}</button><button type="button" className={styles.secondary} onClick={() => go(decision ? "offer" : "reason")} disabled={busy}>Back</button></div>
      </> : null}

      {step === "paused" ? <>
        <span className={styles.doneIcon} aria-hidden="true"><CheckCircle weight="duotone" /></span>
        <h1 ref={heading} tabIndex={-1}>{sub?.pause?.kind === "paused" ? "You’re on a break" : "Your pause is booked"}</h1>
        <p className={styles.lede}>{sub?.pause?.kind === "paused" ? "" : `Banks open until ${formatDate(result.accessUntil) ?? "your renewal date"}. `}Back on {formatDate(result.resumesAt) ?? "the resume date"}{priceLabel ? ` at ${priceLabel}` : ""}. Resume any time from your account.</p>
        <div className={styles.actions}><Link className={styles.primary} href="/account/billing#subscription">Back to your account</Link>{/* Only when they arrived already paused: no cancel nudge right after booking a pause. */}{start === "cancel" && sub?.pause && sub.pause.kind !== "none" ? <button type="button" className={styles.secondary} onClick={() => go("confirm")}>Cancel subscription</button> : null}</div>
      </> : null}
    </div>
  </main>;
}
