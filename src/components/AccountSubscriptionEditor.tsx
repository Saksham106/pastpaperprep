"use client";

import Image from "next/image";
import { BookOpen, CaretDown, CrownSimple, SlidersHorizontal } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { getCatalogBank } from "@/lib/catalog";
import { annualSavingPercent, formatPrice, maximumAnnualSavingPercent, priceForBankCount, PRICING_MODEL } from "@/lib/pricing-model";

type Bank = { slug: string; name: string };
type Plan = {
  id: string;
  cancelAtPeriodEnd: boolean;
  bankSelection: { kind: "all" } | { kind: "selected"; banks: Bank[] } | { kind: "unknown" };
  item: { quantity: number | null; currentPeriodEnd: string | null; price: { interval: string | null } };
};
type Estimate = {
  estimate: { amountDueTodayCents: number; estimatedCreditCents: number; estimatedTaxesCents: number; recurringSubtotalCents: number; currency: string; isEstimate: boolean };
  target: { productId: string; selectedBankIds: string[]; interval: string; renewalAt: string | null };
  snapshot: { prorationDate: number; selectedBankIds: string[]; allAccess: boolean; interval: string; [key: string]: unknown };
};
type RenewalQuote = { status: "preview"; snapshot: { subscriptionId: string; currentPeriodStart: number; currentPeriodEnd: number; currentPriceId: string; currentQuantity: number; currentProductId: string; currentSelectedBankIds: string[]; currentInterval: string; targetPriceId: string; quantity: number; recurringSubtotalCents: number; selectedBankIds: string[]; allAccess: boolean; interval: string; quotedAt: number }; effectiveAt: string; currency: string };
type View = "select" | "review" | "renewal-review" | "cancel-review";

const money = (cents: number, currency: string) => currency === "usd" && Number.isSafeInteger(cents) && cents >= 0
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100) : null;
const date = (iso: string | null) => iso && Number.isFinite(Date.parse(iso))
  ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso)) : null;
async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Billing is temporarily unavailable. Nothing has been changed.");
  return result;
}

/** Immediate additions use a Stripe invoice preview; removals, swaps, and cadence changes use a reviewed native renewal schedule. */
export function AccountSubscriptionEditor({ subscription, bankOptions, onUpdated, demo = false }: { subscription: Plan; bankOptions: Bank[]; onUpdated: (message?: string) => void; demo?: boolean }) {
  const currentIds = subscription.bankSelection.kind === "selected" ? subscription.bankSelection.banks.map(({ slug }) => slug) : [];
  const currentInterval = subscription.item.price.interval === "year" ? "annual" : "monthly";
  const currentMode = subscription.bankSelection.kind === "all" ? "all" : currentIds.length === 1 ? "single" : "builder";
  const [interval, setInterval] = useState<"monthly" | "annual">(currentInterval);
  const [view, setView] = useState<View>("select");
  const [mode, setMode] = useState<"single" | "builder" | "all">(currentMode);
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [allAccess, setAllAccess] = useState(subscription.bankSelection.kind === "all");
  const [quote, setQuote] = useState<Estimate | null>(null);
  const [renewalQuote, setRenewalQuote] = useState<RenewalQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const pendingRemainingCount = pendingRemoval ? (mode === "builder" ? selected : currentIds).filter((id) => id !== pendingRemoval).length : null;
  const removalTrigger = useRef<HTMLInputElement | null>(null);
  const removalDialog = useRef<HTMLDialogElement | null>(null);
  const keepBankButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!pendingRemoval) {
      removalTrigger.current?.focus();
      removalTrigger.current = null;
      return;
    }
    const dialog = removalDialog.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", ""); // jsdom has no native dialog methods.
    keepBankButton.current?.focus();
    return () => {
      if (!dialog.open) return;
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };
  }, [pendingRemoval]);


  const selectedIds = [...selected].sort();
  const validSelection = mode === "all" || mode === "single" && selectedIds.length === 1 || mode === "builder" && selectedIds.length >= 2 && selectedIds.length <= 5;
  const sameBanks = subscription.bankSelection.kind === "all" ? allAccess :
    subscription.bankSelection.kind === "selected" && !allAccess && selectedIds.length === currentIds.length && currentIds.every((id) => selectedIds.includes(id));
  const unchanged = sameBanks && interval === currentInterval && mode === currentMode;
  const expansion = interval === currentInterval && subscription.bankSelection.kind === "selected" && (allAccess ||
    selectedIds.length > currentIds.length && selectedIds.length <= 5 && currentIds.every((id) => selectedIds.includes(id)));
  const renewalChange = validSelection && !unchanged && !expansion;
  const input = { selectedBankIds: allAccess ? [] : selectedIds, allAccess, interval };
  function reset() { setView("select"); setPendingRemoval(null); setQuote(null); setRenewalQuote(null); setError(""); }
  function chooseMode(next: "single" | "builder" | "all") {
    setPendingRemoval(null); setMode(next); setAllAccess(next === "all"); setQuote(null); setRenewalQuote(null); setError("");
    if (next === "single") setSelected([selected[0] ?? currentIds[0] ?? bankOptions[0].slug]);
    if (next === "builder" && selected.length === 0) setSelected(currentIds.length ? currentIds : [bankOptions[0].slug]);
  }
  function updateBuilder(next: string[]) {
    setMode("builder"); setAllAccess(false); setSelected(next);
    setQuote(null); setRenewalQuote(null); setError("");
  }
  function dismissRemoval() { setPendingRemoval(null); }
  function confirmRemoval() {
    if (!pendingRemoval || busy || subscription.cancelAtPeriodEnd) return;
    const base = mode === "builder" ? selected : currentMode === "all" ? [] : currentIds;
    if (base.includes(pendingRemoval) && currentIds.includes(pendingRemoval)) updateBuilder(base.filter((id) => id !== pendingRemoval));
    dismissRemoval();
  }
  function toggle(slug: string, trigger?: HTMLInputElement) {
    const base = mode === "builder" ? selected : currentMode === "all" ? [] : currentIds;
    if (!base.includes(slug) && base.length >= 5) return;
    if (base.includes(slug) && currentIds.includes(slug)) {
      removalTrigger.current = trigger ?? null;
      setPendingRemoval(slug);
      return;
    }
    setPendingRemoval(null);
    updateBuilder(base.includes(slug) ? base.filter((id) => id !== slug) : [...base, slug]);
  }
  function selectSingle(slug: string) {
    setPendingRemoval(null); setMode("single"); setAllAccess(false); setSelected([slug]);
    setQuote(null); setRenewalQuote(null); setError("");
  }
  async function preview() {
    if (demo) return;
    if (!expansion || busy || pendingRemoval) return;
    setBusy(true); setError(""); setQuote(null);
    try {
      const result = await post("/api/billing/subscription/change/preview", input) as Estimate;
      if (!result.snapshot || result.snapshot.interval !== interval || result.snapshot.allAccess !== allAccess ||
        !Array.isArray(result.snapshot.selectedBankIds) || !Number.isSafeInteger(result.snapshot.prorationDate) ||
        money(result.estimate?.amountDueTodayCents, result.estimate?.currency) === null ||
        money(result.estimate?.recurringSubtotalCents, result.estimate?.currency) === null) throw new Error("Quote could not be verified. Try again.");
      setQuote(result); setView("review");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not preview the change."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (demo) return;
    if (!quote || busy) return;
    // The server rechecks quote age and all provider state under its reservation.
    setBusy(true); setError("");
    try {
      const result = await post("/api/billing/subscription/change/confirm", { ...input, snapshot: quote.snapshot });
      if (result.status !== "pending" && result.status !== "processing") throw new Error("Could not verify the change. Check Billing before trying again.");
      const message = result.status === "pending"
        ? "Payment is pending. Your existing banks remain available; check Billing to complete any required payment. New banks are not available yet."
        : "Stripe is processing the change. Your bank access updates after payment is verified.";
      setNotice(message); setView("select"); setQuote(null);
      // A processing response is not paid access. Reset the picker to the last verified plan until readback changes.
      setSelected(currentIds); setAllAccess(subscription.bankSelection.kind === "all"); setMode(currentMode); setInterval(currentInterval);
      onUpdated(message);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not verify the change. Check Billing before trying again.";
      setError(message);
      setQuote(null); setView("select");
    } finally { setBusy(false); }
  }
  async function previewRenewal() {
    if (demo) return;
    if (!renewalChange || busy || pendingRemoval) return;
    setBusy(true); setError(""); setRenewalQuote(null);
    try {
      const result = await post("/api/billing/subscription/schedule", { intent: "preview", ...input }) as RenewalQuote;
      const snapshot = result.snapshot;
      if (result.status !== "preview" || snapshot?.subscriptionId !== subscription.id || snapshot.interval !== interval ||
        snapshot.allAccess !== allAccess || JSON.stringify(snapshot.selectedBankIds) !== JSON.stringify(input.selectedBankIds) ||
        !Number.isSafeInteger(snapshot.currentPeriodStart) || !Number.isSafeInteger(snapshot.currentPeriodEnd) ||
        typeof snapshot.currentPriceId !== "string" || !snapshot.currentPriceId || snapshot.currentQuantity !== subscription.item.quantity ||
        JSON.stringify(snapshot.currentSelectedBankIds) !== JSON.stringify(currentIds) || snapshot.currentInterval !== currentInterval ||
        !Number.isSafeInteger(snapshot.quotedAt) ||
        money(snapshot.recurringSubtotalCents, result.currency) === null || !date(result.effectiveAt)) throw new Error("Renewal quote could not be verified. Try again.");
      setRenewalQuote(result); setView("renewal-review");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not preview the renewal change."); }
    finally { setBusy(false); }
  }
  async function confirmRenewal() {
    if (demo) return;
    if (!renewalQuote || busy) return;
    setBusy(true); setError("");
    try {
      const result = await post("/api/billing/subscription/schedule", { intent: "create", ...input, snapshot: renewalQuote.snapshot });
      if (result.status !== "scheduled" || typeof result.scheduleId !== "string" || result.effectiveAt !== renewalQuote.effectiveAt) throw new Error("Could not verify the schedule. Check Billing before trying again.");
      const message = `Plan change scheduled for ${date(renewalQuote.effectiveAt)}. Your current banks remain available until then; new access starts only after renewal payment is verified.`;
      setNotice(message); setView("select"); setRenewalQuote(null); onUpdated(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify the schedule. Check Billing before trying again.");
      setRenewalQuote(null); setView("select");
    } finally { setBusy(false); }
  }
  async function changeCancellation(intent: "cancel" | "undo") {
    if (demo) return;
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await post("/api/billing/subscription/cancellation", { intent });
      if (result.cancelAtPeriodEnd !== (intent === "cancel") || typeof result.effectiveAt !== "string") throw new Error("Could not verify the cancellation. Check Billing before trying again.");
      const message = intent === "cancel" ? `Cancellation scheduled. Access continues through ${date(result.effectiveAt)}.` : "Cancellation undone. Your subscription remains active.";
      setNotice(message); setView("select"); onUpdated(message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not change cancellation. Nothing is confirmed."); }
    finally { setBusy(false); }
  }

  if (subscription.bankSelection.kind === "unknown" || !bankOptions.length) return null;
  const bankGroups = [
    { label: "Cambridge", banks: bankOptions.filter((bank) => getCatalogBank(bank.slug)?.qualification === "Cambridge IGCSE") },
    { label: "IB Mathematics", banks: bankOptions.filter((bank) => getCatalogBank(bank.slug)?.qualification === "IB Diploma" && getCatalogBank(bank.slug)?.subject.startsWith("Mathematics")) },
    { label: "IB Sciences", banks: bankOptions.filter((bank) => getCatalogBank(bank.slug)?.qualification === "IB Diploma" && !getCatalogBank(bank.slug)?.subject.startsWith("Mathematics")) },
    { label: "Other banks", banks: bankOptions.filter((bank) => !getCatalogBank(bank.slug)) },
  ].filter((group) => group.banks.length > 0);
  return <div className="account-plan-editor">
    {notice ? <p role="status" className="account-editor-note">{notice}</p> : null}
    {error ? <p role="alert" className="account-billing-warning">{error}</p> : null}
    {view === "select" ? <div className="account-plan-chooser">
      <div className="account-pricing-heading"><h2>Choose your plan</h2><p>Choose the banks you need. Your current access is marked; review any change before it takes effect.</p></div>
      <div className="billing-toggle" role="group" aria-label="Billing period">
        <button type="button" aria-pressed={interval === "monthly"} disabled={busy || subscription.cancelAtPeriodEnd} onClick={() => { setInterval("monthly"); setQuote(null); setRenewalQuote(null); }}>Monthly</button>
        <button type="button" className="billing-toggle-annual" aria-pressed={interval === "annual"} disabled={busy || subscription.cancelAtPeriodEnd} onClick={() => { setInterval("annual"); setQuote(null); setRenewalQuote(null); }}>Annual <span className="billing-savings">Save up to {maximumAnnualSavingPercent()}%</span></button>
      </div>
      <div className="pricing-decision-grid account-pricing-grid" aria-label="PastPaperPrep plans" data-paid="true">
        {(["single", "builder", "all"] as const).map((option) => {
          const name = option === "single" ? "One Bank" : option === "builder" ? "Build Your Plan" : "All Access";
          const PlanIcon = option === "single" ? BookOpen : option === "builder" ? SlidersHorizontal : CrownSimple;
          const artwork = option === "single" ? "/artwork/aristotle-tutoring-alexander.webp" : option === "builder" ? "/artwork/school-of-athens-plato-aristotle.webp" : "/artwork/plato-academy-mosaic.webp";
          const current = currentMode === option;
          const active = mode === option;
          const ownedSingle = current && option === "single";
          const pickerIds = mode === "builder" ? selected : currentMode === "builder" ? currentIds : currentMode === "single" ? currentIds : [];
          const removedOwned = option === "builder" && active ? currentIds.filter((id) => !selected.includes(id)) : [];
          const count = option === "single" ? 1 : Math.max(2, pickerIds.length);
          const startingRate = option === "builder" && pickerIds.length < 2;
          const monthlyCents = option === "all" ? PRICING_MODEL.allAccess.monthlyCents : priceForBankCount("monthly", count);
          const annualCents = option === "all" ? PRICING_MODEL.allAccess.annualCents : priceForBankCount("annual", count);
          const headline = formatPrice(interval === "annual" ? annualCents / 12 : monthlyCents);
          const billingNote = startingRate ? "Two-bank minimum. Select banks to see your exact price."
            : interval === "annual" ? `Billed ${formatPrice(annualCents)} once a year. Save ${annualSavingPercent(monthlyCents, annualCents)}%`
              : "Billed monthly";
          const canReview = active && validSelection && !unchanged;
          const action = ownedSingle ? !active || unchanged ? "Your bank" : "Review billing change"
            : active ? !validSelection ? "Choose one more bank" : unchanged ? "Your plan" : expansion ? "Review change" : "Review renewal change"
              : current ? option === "builder" ? "Edit your banks" : "Keep All Access" : `Switch to ${name}`;
          const disabled = busy || subscription.cancelAtPeriodEnd || Boolean(pendingRemoval) || ownedSingle && !active || active && (demo || !validSelection || unchanged);
          return <article className={`pricing-option${option === "builder" ? " pricing-option-popular" : ""}${current ? " pricing-option-current" : ""}`} data-plan-tone={option === "single" ? "starter" : option === "all" ? "premium" : "builder"} data-current-plan={current ? "true" : undefined} data-selected={active ? "true" : undefined} data-mobile-order={option === "builder" ? "first" : undefined} key={option}>
            <Image className="plan-art" src={artwork} alt="" width={420} height={260} aria-hidden="true" sizes="(max-width: 1024px) 68vw, 300px" />
            <div className="pricing-option-heading"><div className="plan-title-block"><span className="plan-icon" aria-hidden="true"><PlanIcon weight="duotone" /></span><div><p className="plan-label">{option === "single" ? "One bank" : option === "builder" ? "2 to 5 banks" : "All access"}</p><h2>{name}</h2></div></div>
              {current ? <span className="pricing-badge pricing-badge-current">Your access</span> : option === "builder" ? <span className="pricing-badge">Most popular</span> : null}
            </div>
            <div className="plan-price account-plan-card-price"><strong aria-live="polite">{headline}</strong><span>/ month</span></div>
            <p className="plan-billing-note">{billingNote}{current && interval !== currentInterval ? ` · Current billing is ${currentInterval}` : ""}</p>
            <p className="plan-description">{option === "single" ? "Focus on one syllabus." : option === "builder" ? "Mix the banks you actually take." : "Everything, including future banks."}</p>
            <div className="plan-checkout custom-bundle-checkout">
              {ownedSingle ? <div className="custom-bank-disclosure account-owned-bank"><span>Your bank</span><span className="custom-bank-disclosure-value">{bankOptions.find((bank) => bank.slug === currentIds[0])?.name ?? currentIds[0]}</span></div>
                : option !== "all" ? <details className="custom-bank-disclosure"><summary><span>{option === "single" ? "Choose question bank" : "Choose your banks"}</span><span className="custom-bank-disclosure-value">{option === "single" ? active ? bankOptions.find((bank) => bank.slug === selected[0])?.name ?? "Choose a bank" : "Choose a bank" : pickerIds.length ? `${pickerIds.length} selected` : "None selected"}</span><CaretDown aria-hidden="true" weight="bold" /></summary>
                <fieldset className="custom-bank-picker" disabled={busy || subscription.cancelAtPeriodEnd}><legend className="sr-only">{option === "single" ? "Choose one question bank" : "Choose the banks you need"}</legend><div className="custom-bank-groups">
                  {bankGroups.map((group) => <section className="custom-bank-group" key={`${option}-${group.label}`} aria-label={group.label}><h3>{group.label}</h3><div className="custom-bank-group-options">{group.banks.map((bank) => <label key={bank.slug} data-bank-id={bank.slug}><input type={option === "single" ? "radio" : "checkbox"} name={option === "single" ? "account-one-bank" : `account-bank-${bank.slug}`} checked={option === "single" ? active && selected.includes(bank.slug) : pickerIds.includes(bank.slug)} disabled={option === "builder" && pickerIds.length >= 5 && !pickerIds.includes(bank.slug)} onChange={(event) => option === "single" ? selectSingle(bank.slug) : toggle(bank.slug, event.currentTarget)} /><span>{bank.name}</span>{option === "builder" && currentIds.includes(bank.slug) ? <small className="account-bank-current-tag" aria-hidden="true">Current</small> : null}</label>)}</div></section>)}
                </div></fieldset></details> : null}
              {option === "builder" && pendingRemoval ? <dialog ref={removalDialog} className="account-owned-removal-confirm" role="alertdialog" aria-modal="true" aria-labelledby="account-owned-removal-title" aria-describedby="account-owned-removal-description" onCancel={(event) => { event.preventDefault(); dismissRemoval(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); dismissRemoval(); } }}>
                <h3 id="account-owned-removal-title">Remove {bankOptions.find((bank) => bank.slug === pendingRemoval)?.name ?? pendingRemoval} from your next plan?</h3>
                <p id="account-owned-removal-description">This is one of your paid banks. You keep access through {date(subscription.item.currentPeriodEnd) ?? "your renewal date"}. Removing it has no charge today; the new bank selection and any price change start at renewal, after payment is verified.</p>
                {pendingRemainingCount === 0 ? <p>Builder needs at least two banks. Choose two replacements, or keep your current bank.</p> : pendingRemainingCount === 1 ? <p>{currentMode === "builder" ? "Builder needs at least two banks. To keep just one, switch to One Bank after this step." : "Builder needs at least two banks. Add another bank to continue."}</p> : null}
                <div className="account-owned-removal-actions"><button ref={keepBankButton} type="button" onClick={dismissRemoval}>Keep bank</button><button type="button" onClick={confirmRemoval} disabled={busy || subscription.cancelAtPeriodEnd}>Remove at renewal</button></div>
              </dialog> : null}
              {removedOwned.length ? <p className="account-removal-draft-note">Draft only — {removedOwned.map((id) => bankOptions.find((bank) => bank.slug === id)?.name ?? id).join(", ")} {removedOwned.length === 1 ? "remains" : "remain"} active. Review and confirm to remove {removedOwned.length === 1 ? "it" : "them"} at the {date(subscription.item.currentPeriodEnd)} renewal; otherwise {removedOwned.length === 1 ? "it stays" : "they stay"} on your plan.</p> : null}
              {option === "builder" && active && selected.length < 2 ? <p className="custom-bundle-selection-note">{currentMode === "builder" && selected.length === 1 ? "One bank selected. Add another, or switch to One Bank for a downgrade." : "Select at least two banks to continue."}</p> : null}
              <button className={`button primary${ownedSingle && (!active || unchanged) ? " account-plan-owned-cta" : ""}`} type="button" aria-pressed={active} disabled={disabled} onClick={() => { if (!active) chooseMode(option); else if (canReview) void (expansion ? preview() : previewRenewal()); }}>{demo && active && !unchanged ? "Preview only" : action}</button>
              {demo && active ? <p className="custom-bundle-selection-note">No checkout or account changes in this preview.</p> : null}
            </div>
          </article>;
        })}
      </div>
      <p className="account-plan-timing">{demo ? "Example data only. Select banks or a billing period to see the price; no charge can be made here." : expansion && validSelection ? "Added banks unlock only after Stripe verifies the payment." : renewalChange ? "Removals, swaps and billing-period changes start at renewal after payment is verified." : "Your current plan stays in place until you review and confirm a change."} Displayed prices are standard rates before discounts and taxes; Stripe gives the exact quote before confirmation.</p>
      {subscription.cancelAtPeriodEnd ? <p className="account-plan-timing">Cancellation is scheduled. Undo it before choosing another plan.</p> : null}
      <div className="account-editor-actions">{demo ? null : subscription.cancelAtPeriodEnd ? <button type="button" onClick={() => void changeCancellation("undo")} disabled={busy}>Undo cancellation</button> : <button className="account-cancel-action" type="button" onClick={() => { setNotice(""); setView("cancel-review"); }}>Cancel subscription</button>}</div>
    </div> : null}
    {view === "review" && quote ? <div className="account-editor-review">
      <h3>Review your change</h3>
      <p>New access: {allAccess ? "All Access" : selectedIds.map((slug) => bankOptions.find((bank) => bank.slug === slug)?.name ?? slug).join(", ")}</p>
      <p>Estimated due today: <strong>{money(quote.estimate.amountDueTodayCents, quote.estimate.currency)}</strong></p>
      <p>Includes estimated credit: {money(quote.estimate.estimatedCreditCents, quote.estimate.currency) ?? "Unavailable"}. Estimated tax: {money(quote.estimate.estimatedTaxesCents, quote.estimate.currency) ?? "Unavailable"}.</p>
      <p>New base rate: <strong>{money(quote.estimate.recurringSubtotalCents, quote.estimate.currency)} / {interval === "monthly" ? "month" : "year"}</strong> before discounts and taxes.</p>
      <p>Stripe will calculate the final charge. Added banks unlock only after payment is verified. Your renewal date remains {date(quote.target.renewalAt) ?? "the current date"}.</p>
      <div className="account-editor-actions"><button type="button" onClick={() => void confirm()} disabled={busy}>{busy ? "Confirming…" : "Confirm change"}</button><button type="button" onClick={() => { setQuote(null); setView("select"); }} disabled={busy}>Edit banks</button></div>
    </div> : null}
    {view === "renewal-review" && renewalQuote ? <div className="account-editor-review">
      <h3>Review your renewal change</h3>
      <p>Current banks stay available through {date(renewalQuote.effectiveAt)}. No charge today for this change.</p>
      <p>From {date(renewalQuote.effectiveAt)}: {allAccess ? "All Access" : selectedIds.map((slug) => bankOptions.find((bank) => bank.slug === slug)?.name ?? slug).join(", ")}.</p>
      <p>New base rate: <strong>{money(renewalQuote.snapshot.recurringSubtotalCents, renewalQuote.currency)} / {interval === "monthly" ? "month" : "year"}</strong> before discounts or taxes. Stripe will charge at renewal; bank access changes after that payment is verified.</p>
      <div className="account-editor-actions"><button type="button" onClick={() => void confirmRenewal()} disabled={busy}>{busy ? "Scheduling…" : "Schedule change"}</button><button type="button" onClick={() => { setRenewalQuote(null); setView("select"); }} disabled={busy}>Edit plan</button></div>
    </div> : null}
    {view === "cancel-review" ? <div className="account-editor-review">
      <h3>Cancel at the end of your paid period?</h3>
      <p>Your existing bank access continues through {date(subscription.item.currentPeriodEnd) ?? "the end of your current period"}. You can undo this before it ends.</p>
      <div className="account-editor-actions"><button type="button" onClick={() => void changeCancellation("cancel")} disabled={busy}>{busy ? "Scheduling…" : "Confirm cancellation"}</button><button type="button" onClick={reset} disabled={busy}>Keep subscription</button></div>
    </div> : null}
  </div>;
}
