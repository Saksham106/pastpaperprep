"use client";

import { useState } from "react";

type Bank = { slug: string; name: string };
type Plan = {
  id: string;
  cancelAtPeriodEnd: boolean;
  bankSelection: { kind: "all" } | { kind: "selected"; banks: Bank[] } | { kind: "unknown" };
  item: { currentPeriodEnd: string | null; price: { interval: string | null } };
};
type Estimate = {
  estimate: { amountDueTodayCents: number; estimatedCreditCents: number; estimatedTaxesCents: number; recurringSubtotalCents: number; currency: string; isEstimate: boolean };
  target: { productId: string; selectedBankIds: string[]; interval: string; renewalAt: string | null };
  snapshot: { prorationDate: number; selectedBankIds: string[]; allAccess: boolean; interval: string; [key: string]: unknown };
};
type View = "closed" | "select" | "review" | "cancel-review";

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

/** This editor only submits immediate, same-cadence strict expansions. Other changes require a verified renewal schedule. */
export function AccountSubscriptionEditor({ subscription, bankOptions, onUpdated }: { subscription: Plan; bankOptions: Bank[]; onUpdated: (message?: string) => void }) {
  const currentIds = subscription.bankSelection.kind === "selected" ? subscription.bankSelection.banks.map(({ slug }) => slug) : [];
  const interval = subscription.item.price.interval === "year" ? "annual" : "monthly";
  const [view, setView] = useState<View>("closed");
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [allAccess, setAllAccess] = useState(subscription.bankSelection.kind === "all");
  const [quote, setQuote] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");


  const selectedIds = [...selected].sort();
  const expansion = subscription.bankSelection.kind === "selected" && (allAccess ||
    selectedIds.length > currentIds.length && selectedIds.length <= 5 && currentIds.every((id) => selectedIds.includes(id)));
  const unchanged = !allAccess && selectedIds.length === currentIds.length && currentIds.every((id) => selectedIds.includes(id));
  const input = { selectedBankIds: allAccess ? [] : selectedIds, allAccess, interval };
  function reset() { setView("closed"); setQuote(null); setError(""); }
  function toggle(slug: string) {
    setQuote(null); setError("");
    setSelected((current) => current.includes(slug) ? current.filter((id) => id !== slug) : [...current, slug]);
  }
  async function preview() {
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
    if (!quote || busy) return;
    // The server rechecks quote age and all provider state under its reservation.
    setBusy(true); setError("");
    try {
      const result = await post("/api/billing/subscription/change/confirm", { ...input, snapshot: quote.snapshot });
      if (result.status !== "pending" && result.status !== "processing") throw new Error("Could not verify the change. Check Billing before trying again.");
      const message = result.status === "pending"
        ? "Payment is pending. Your existing banks remain available; check Billing to complete any required payment. New banks are not available yet."
        : "Stripe is processing the change. Your bank access updates after payment is verified.";
      setNotice(message); setView("closed"); setQuote(null); onUpdated(message);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not verify the change. Check Billing before trying again.";
      setError(message);
      setQuote(null); setView("select");
    } finally { setBusy(false); }
  }
  async function changeCancellation(intent: "cancel" | "undo") {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await post("/api/billing/subscription/cancellation", { intent });
      if (result.cancelAtPeriodEnd !== (intent === "cancel") || typeof result.effectiveAt !== "string") throw new Error("Could not verify the cancellation. Check Billing before trying again.");
      const message = intent === "cancel" ? `Cancellation scheduled. Access continues through ${date(result.effectiveAt)}.` : "Cancellation undone. Your subscription remains active.";
      setNotice(message); setView("closed"); onUpdated(message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not change cancellation. Nothing is confirmed."); }
    finally { setBusy(false); }
  }

  if (subscription.bankSelection.kind === "unknown" || !bankOptions.length) return null;
  return <div className="account-plan-editor">
    {notice ? <p role="status" className="account-editor-note">{notice}</p> : null}
    {error ? <p role="alert" className="account-billing-warning">{error}</p> : null}
    {view === "closed" ? <div className="account-editor-actions">
      {!subscription.cancelAtPeriodEnd && subscription.bankSelection.kind !== "all" ? <button type="button" onClick={() => { setNotice(""); setView("select"); }}>Change plan</button> : null}
      {subscription.cancelAtPeriodEnd ? <button type="button" onClick={() => void changeCancellation("undo")} disabled={busy}>Undo cancellation</button>
        : <button type="button" onClick={() => { setNotice(""); setView("cancel-review"); }}>Cancel subscription</button>}
    </div> : null}
    {view === "select" ? <div className="account-editor-form">
      <h3>Choose your final bank access</h3>
      <p>Adding banks can take effect after payment. Removing or replacing banks needs a renewal-date change.</p>
      <fieldset disabled={busy}><legend>Banks</legend>
        {bankOptions.map((bank) => <label key={bank.slug}><input type="checkbox" checked={!allAccess && selected.includes(bank.slug)} onChange={() => toggle(bank.slug)} disabled={allAccess} />{bank.name}</label>)}
      </fieldset>
      <label className="account-editor-all"><input type="checkbox" checked={allAccess} onChange={(event) => { setAllAccess(event.target.checked); setQuote(null); setError(""); }} />All Access</label>
      <p>Billing cadence: {interval === "monthly" ? "Monthly" : "Annual"}. Cadence changes are not available here yet.</p>
      {selected.length > 5 && !allAccess ? <p role="status">Choose All Access instead of more than five individual banks.</p> : null}
      {!expansion && !unchanged ? <p role="status">Renewal-date changes are not available yet. Your current plan will not change.</p> : null}
      <div className="account-editor-actions">{expansion ? <button type="button" onClick={() => void preview()} disabled={busy}>{busy ? "Getting quote…" : "Review change"}</button> : null}<button type="button" onClick={reset} disabled={busy}>Back</button></div>
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
    {view === "cancel-review" ? <div className="account-editor-review">
      <h3>Cancel at the end of your paid period?</h3>
      <p>Your existing bank access continues through {date(subscription.item.currentPeriodEnd) ?? "the end of your current period"}. You can undo this before it ends.</p>
      <div className="account-editor-actions"><button type="button" onClick={() => void changeCancellation("cancel")} disabled={busy}>{busy ? "Scheduling…" : "Confirm cancellation"}</button><button type="button" onClick={reset} disabled={busy}>Keep subscription</button></div>
    </div> : null}
  </div>;
}
