"use client";

import { useState } from "react";
import { priceForBankCount, PRICING_MODEL } from "@/lib/pricing-model";

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


  const selectedIds = [...selected].sort();
  const validSelection = mode === "all" || mode === "single" && selectedIds.length === 1 || mode === "builder" && selectedIds.length >= 2 && selectedIds.length <= 5;
  const sameBanks = subscription.bankSelection.kind === "all" ? allAccess :
    subscription.bankSelection.kind === "selected" && !allAccess && selectedIds.length === currentIds.length && currentIds.every((id) => selectedIds.includes(id));
  const unchanged = sameBanks && interval === currentInterval && mode === currentMode;
  const expansion = interval === currentInterval && subscription.bankSelection.kind === "selected" && (allAccess ||
    selectedIds.length > currentIds.length && selectedIds.length <= 5 && currentIds.every((id) => selectedIds.includes(id)));
  const renewalChange = validSelection && !unchanged && !expansion;
  const input = { selectedBankIds: allAccess ? [] : selectedIds, allAccess, interval };
  function reset() { setView("select"); setQuote(null); setRenewalQuote(null); setError(""); }
  function chooseMode(next: "single" | "builder" | "all") {
    setMode(next); setAllAccess(next === "all"); setQuote(null); setRenewalQuote(null); setError("");
    if (next === "single") setSelected([selected[0] ?? currentIds[0] ?? bankOptions[0].slug]);
    if (next === "builder" && selected.length === 0) setSelected(currentIds.length ? currentIds : [bankOptions[0].slug]);
  }
  function toggle(slug: string) {
    if (!selected.includes(slug) && selected.length >= 5) return;
    setQuote(null); setRenewalQuote(null); setError("");
    setSelected((current) => current.includes(slug) ? current.filter((id) => id !== slug) : [...current, slug]);
  }
  async function preview() {
    if (demo) return;
    if (!expansion || busy) return;
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
    if (!renewalChange || busy) return;
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
  return <div className="account-plan-editor">
    {notice ? <p role="status" className="account-editor-note">{notice}</p> : null}
    {error ? <p role="alert" className="account-billing-warning">{error}</p> : null}
    {view === "select" ? <div className="account-plan-chooser">
      <div className="account-plan-chooser-head"><div><h3>Choose your plan</h3><p>Your current plan is marked below. Prices update as you choose banks; Stripe calculates any amount due today in the final review.</p></div>
        <label>Billing cadence <select aria-label="Billing cadence" value={interval} disabled={busy || subscription.cancelAtPeriodEnd} onChange={(event) => { setInterval(event.target.value as "monthly" | "annual"); setQuote(null); setRenewalQuote(null); setError(""); }}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>
      </div>
      <div className="account-plan-cards" aria-label="Subscription plans">
        {(["single", "builder", "all"] as const).map((option) => {
          const name = option === "single" ? "One Bank" : option === "builder" ? "Build Your Plan" : "All Access";
          const count = option === "single" ? 1 : Math.max(2, mode === "builder" ? selected.length : currentMode === "builder" ? currentIds.length : 2);
          const builderStartingRate = option === "builder" && (mode !== "builder" && currentMode !== "builder" || mode === "builder" && selected.length < 2);
          const cents = option === "all" ? interval === "monthly" ? PRICING_MODEL.allAccess.monthlyCents : PRICING_MODEL.allAccess.annualCents : priceForBankCount(interval, count);
          const amount = money(cents, "usd");
          return <article className="account-plan-card" data-plan-tone={option === "all" ? "premium" : option} data-current-plan={currentMode === option ? "true" : undefined} data-selected={mode === option ? "true" : undefined} key={option}>
            <div className="account-plan-card-top"><h4>{name}</h4>{currentMode === option ? <span className="account-plan-current">Your plan</span> : null}</div>
            <p className="account-plan-card-price" aria-live="polite">{builderStartingRate ? <span>From </span> : null}{amount} <span>/ {interval === "monthly" ? "month" : "year"}</span></p>
            <p className="account-plan-card-description">{option === "single" ? "One question bank." : option === "builder" ? builderStartingRate ? "Choose 2 to 5 banks." : `${count} banks. Pick the ones you study.` : "Every available question bank."}{option === currentMode && interval !== currentInterval ? <span className="account-plan-original-cadence"> Your current billing is {currentInterval}.</span> : null}</p>
            <button type="button" aria-pressed={mode === option} disabled={busy || subscription.cancelAtPeriodEnd} onClick={() => chooseMode(option)}>{mode === option ? "Selected" : `Select ${name}`}</button>
          </article>;
        })}
      </div>
      {mode === "single" ? <label className="account-plan-single">Your bank <select aria-label="Choose one bank" value={selected[0] ?? ""} disabled={busy || subscription.cancelAtPeriodEnd} onChange={(event) => { setSelected([event.target.value]); setQuote(null); setRenewalQuote(null); setError(""); }}>
        {bankOptions.map((bank) => <option value={bank.slug} key={bank.slug}>{bank.name}{currentIds.includes(bank.slug) ? " (current)" : ""}</option>)}
      </select></label> : null}
      {mode === "builder" ? <div className="account-editor-form"><fieldset disabled={busy || subscription.cancelAtPeriodEnd}><legend>Choose 2 to 5 banks</legend>
        {bankOptions.map((bank) => <label key={bank.slug}><input type="checkbox" checked={selected.includes(bank.slug)} disabled={!selected.includes(bank.slug) && selected.length >= 5} onChange={() => toggle(bank.slug)} />{bank.name}{currentIds.includes(bank.slug) ? <span className="account-plan-owned">Current</span> : null}</label>)}
      </fieldset>{selected.length < 2 ? <p role="status">Choose one more bank to build your plan.</p> : selected.length > 5 ? <p role="status">Choose All Access instead of more than five banks.</p> : null}</div> : null}
      <p className="account-plan-timing">{demo ? "Preview only. Select a plan, banks, and cadence to see the rate. No account or payment changes are possible here." : expansion && validSelection ? "Added banks can unlock after the new payment succeeds." : renewalChange ? "This change starts at your next renewal. Your existing banks stay available until then." : "Your current plan stays unchanged until you review and confirm a change."} Base rate shown before discounts and taxes.</p>
      {subscription.cancelAtPeriodEnd ? <p className="account-plan-timing">Cancellation is scheduled. Undo it before choosing another plan.</p> : null}
      <div className="account-editor-actions">{!demo && !subscription.cancelAtPeriodEnd && validSelection && expansion ? <button type="button" onClick={() => void preview()} disabled={busy}>{busy ? "Getting quote…" : "Review change"}</button> : null}
        {!demo && !subscription.cancelAtPeriodEnd && validSelection && renewalChange ? <button type="button" onClick={() => void previewRenewal()} disabled={busy}>{busy ? "Getting rate…" : "Review renewal change"}</button> : null}
        {demo ? null : subscription.cancelAtPeriodEnd ? <button type="button" onClick={() => void changeCancellation("undo")} disabled={busy}>Undo cancellation</button> : <button className="account-cancel-action" type="button" onClick={() => { setNotice(""); setView("cancel-review"); }}>Cancel subscription</button>}
      </div>
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
