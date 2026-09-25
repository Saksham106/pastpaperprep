"use client";

import { useEffect, useState } from "react";
import { AccountSubscriptionEditor } from "@/components/AccountSubscriptionEditor";

type Item = {
  id: string; quantity: number | null; recurringSubtotalCents: number | null;
  price: { currency: string; interval: string | null; intervalCount: number | null };
  currentPeriodEnd: string | null;
};
type Subscription = {
  id: string; status: string; cancelAtPeriodEnd: boolean; cancelAt: string | null; pendingUpdate?: boolean; scheduledChange?: boolean;
  scheduledPlan?: { id: string; effectiveAt: string; interval: string; bankSelection: { kind: "all" } | { kind: "selected"; banks: { slug: string; name: string }[] } | { kind: "unknown" } } | null;
  bankSelection: { kind: "all" } | { kind: "selected"; banks: { slug: string; name: string }[] } | { kind: "unknown" };
  items: Item[];
};
type BillingResponse = {
  subscriptions: Subscription[];
  invoices: { id: string; status: string | null; amountPaid: number; amountDue: number; currency: string; created: string; hostedInvoiceUrl?: string | null }[];
  invoicesHasMore?: boolean;
  paymentMethod: { type: string | null; bankName?: string | null; last4?: string | null; cardBrand?: string | null; cardExpiryMonth?: number | null; cardExpiryYear?: number | null } | null;
  management: { editable: boolean; reason?: string };
  bankOptions?: { slug: string; name: string }[];
};
type LoadState = { kind: "loading" } | { kind: "none" } | { kind: "error" } | { kind: "loaded"; data: BillingResponse };

function date(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed) : null;
}
function money(cents: number | null | undefined, currency: string) {
  if (typeof cents !== "number" || !Number.isSafeInteger(cents) || currency.toLowerCase() !== "usd") return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
function hostedStripeInvoice(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "invoice.stripe.com" && !url.username && !url.password && url.pathname.startsWith("/i/") ? url.href : null;
  } catch { return null; }
}
function cadence(item: Item) {
  if (item.price.interval !== "month" && item.price.interval !== "year") return null;
  const unit = item.price.interval === "month" ? "month" : "year";
  return item.price.intervalCount && item.price.intervalCount > 1 ? `${item.price.intervalCount} ${unit}s` : unit;
}

function ScheduledChange({ plan, onUpdated, canUndo }: { plan: NonNullable<Subscription["scheduledPlan"]>; onUpdated: (message: string) => void; canUndo: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const target = plan.bankSelection.kind === "all" ? "All Access" : plan.bankSelection.kind === "selected" ? plan.bankSelection.banks.map((bank) => bank.name).join(", ") : "a different plan";
  async function undo() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/billing/subscription/schedule", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: "undo", scheduleId: plan.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Could not verify the undo. Check Billing before trying again.");
      if (result.status !== "released") throw new Error("Could not verify the undo. Check Billing before trying again.");
      onUpdated("Scheduled change undone. Your current subscription remains active.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not verify the undo. Check Billing before trying again."); }
    finally { setBusy(false); }
  }
  return <div className="account-editor-review">
    <p className="account-billing-warning">Scheduled: {target} from {date(plan.effectiveAt) ?? "your next renewal"} ({plan.interval === "annual" ? "annual" : "monthly"}). Your current banks remain available until renewal; the change takes effect only after the renewal payment is verified.</p>
    {error ? <p role="alert" className="account-billing-warning">{error}</p> : null}
    {canUndo ? <button type="button" onClick={() => void undo()} disabled={busy}>{busy ? "Undoing…" : "Undo scheduled change"}</button> : null}
  </div>;
}

export function AccountBillingDetails({ mode }: { mode: "subscription" | "billing" }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [operationNotice, setOperationNotice] = useState("");
  async function refresh() {
    try {
      const response = await fetch("/api/billing/subscription", { cache: "no-store" });
      if (!response.ok) { setState({ kind: response.status === 404 ? "none" : "error" }); return; }
      const data = await response.json() as BillingResponse;
      if (!Array.isArray(data.subscriptions) || !Array.isArray(data.invoices)) throw new Error("Invalid billing response");
      setState({ kind: "loaded", data });
    } catch { setState({ kind: "error" }); }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/billing/subscription", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) { setState({ kind: "none" }); return; }
        if (!response.ok) { setState({ kind: "error" }); return; }
        const data = await response.json() as BillingResponse;
        if (!Array.isArray(data.subscriptions) || !Array.isArray(data.invoices)) throw new Error("Invalid billing response");
        setState({ kind: "loaded", data });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ kind: "error" }); });
    return () => controller.abort();
  }, []);

  if (state.kind === "loading") return <p role="status">Loading subscription details…</p>;
  if (state.kind === "error") return <>{operationNotice ? <p role="status">{operationNotice}</p> : null}<p role="alert">Subscription details are temporarily unavailable. Check Billing or try again later.</p></>;
  if (state.kind === "none") return <p className="account-empty-state">No Stripe subscription is connected to this account. Complimentary access, if any, is separate from billing.</p>;
  const { subscriptions, invoices, paymentMethod } = state.data;

  if (mode === "billing") return (
    <div className="account-billing-detail">
      <section aria-label="Payment method" className="account-detail-block">
        <h2>Payment method</h2>
        <p>{paymentMethod?.last4
          ? `${paymentMethod.cardBrand ?? paymentMethod.bankName ?? paymentMethod.type ?? "Payment method"} ending in ${paymentMethod.last4}`
          : "See the secure billing portal for your payment method."}</p>
      </section>
      <section aria-label="Recent invoices" className="account-detail-block">
        <h2>Recent invoices</h2>
        {invoices.length ? <ul className="account-billing-list">{invoices.map((invoice) => <li key={invoice.id}>
          <span>{date(invoice.created) ?? "Date unavailable"}</span>
          <span>{invoice.status === "paid" ? "Paid" : invoice.status ?? "Invoice"} · {invoice.status === "paid" ? money(invoice.amountPaid, invoice.currency) ?? "Amount unavailable" : `${money(invoice.amountDue, invoice.currency) ?? "Amount unavailable"} due`}
            {invoice.status === "open" && hostedStripeInvoice(invoice.hostedInvoiceUrl) ? <> <a href={hostedStripeInvoice(invoice.hostedInvoiceUrl)!} target="_blank" rel="noopener noreferrer">Pay invoice in Stripe</a></> : null}
          </span>
        </li>)}</ul> : <p>No invoices to display yet.</p>}
        {state.data.invoicesHasMore ? <p>More invoices are available in the secure billing portal.</p> : null}
      </section>
    </div>
  );

  if (!subscriptions.length) return <p className="account-empty-state">No Stripe subscriptions are connected to this billing account.</p>;
  const current = subscriptions.filter((sub) => sub.status !== "canceled" && sub.status !== "incomplete_expired");
  if (!current.length) return <p className="account-empty-state">No current paid subscriptions. Your past invoices remain available in Billing.</p>;
  return (
    <div className="account-billing-detail">
      {operationNotice ? <p role="status" className="account-editor-note">{operationNotice}</p> : null}
      {current.length > 1 ? <p className="account-billing-warning">These are billed as separate subscriptions, possibly on different renewal dates. Changing one will not change the others.</p> : null}
      {current.map((sub) => {
        const item = sub.items.length === 1 ? sub.items[0] : null;
        const amount = item ? money(item.recurringSubtotalCents, item.price.currency) : null;
        const interval = item ? cadence(item) : null;
        const periodEnd = item ? date(item.currentPeriodEnd) : null;
        return <section className="account-detail-block" data-testid="subscription-detail" key={sub.id} aria-label={`Subscription ${sub.id}`}>
          <div className="account-detail-heading"><h2>{sub.bankSelection.kind === "all" ? "All Access" : sub.bankSelection.kind === "selected" ? `${sub.bankSelection.banks.length} ${sub.bankSelection.banks.length === 1 ? "bank" : "banks"}` : "Subscription"}</h2><span>{sub.status === "active" && sub.cancelAtPeriodEnd ? "Ending" : sub.status.replaceAll("_", " ")}</span></div>
          {sub.bankSelection.kind === "selected" ? <ul className="account-bank-list">{sub.bankSelection.banks.map((bank) => <li key={bank.slug}>{bank.name}</li>)}</ul> : sub.bankSelection.kind === "all" ? <p>Every available bank is included.</p> : <p>Bank selection unavailable. Check your invoice or contact support.</p>}
          <p className="account-billing-amount">{amount && interval ? `${amount} / ${interval}` : "Plan price unavailable; see your Stripe invoice."}<span> Base rate before discounts, credits, or taxes.</span></p>
          {periodEnd ? <p className="account-billing-date">{sub.cancelAtPeriodEnd ? `Access through ${periodEnd}` : `Current period ends ${periodEnd}`}</p> : null}
          {sub.pendingUpdate ? <p className="account-billing-warning">A subscription change is awaiting payment. Current bank access remains in place until Stripe confirms the payment. Check Billing for the invoice or payment method.</p> : null}
          {sub.scheduledChange && sub.scheduledPlan ? <ScheduledChange plan={sub.scheduledPlan} canUndo={current.length === 1 && sub.status === "active"} onUpdated={(message) => { setOperationNotice(message); void refresh(); }} /> : null}
          {sub.scheduledChange && !sub.scheduledPlan ? <p className="account-billing-warning">A future subscription change is scheduled in Stripe. This editor cannot safely change it here.</p> : null}
          {state.data.management.editable && current.length === 1 && sub.status === "active" && item && state.data.bankOptions?.length ? <AccountSubscriptionEditor
            key={`${sub.id}:${sub.cancelAtPeriodEnd}:${item.id}:${item.price.interval}:${item.recurringSubtotalCents}:${sub.bankSelection.kind === "selected" ? sub.bankSelection.banks.map((bank) => bank.slug).sort().join(",") : sub.bankSelection.kind}`}
            subscription={{ id: sub.id, cancelAtPeriodEnd: sub.cancelAtPeriodEnd, bankSelection: sub.bankSelection, item }}
            bankOptions={state.data.bankOptions}
            onUpdated={(message) => { setOperationNotice(message ?? "Billing state updated."); void refresh(); }}
          /> : null}
          {sub.status === "past_due" || sub.status === "unpaid" ? <p className="account-billing-warning">Payment needs attention. Review your payment method in the secure billing portal.</p> : null}
        </section>;
      })}
      {!state.data.management.editable ? <p className="account-page-help">{current.length === 1 && current[0].scheduledPlan
        ? "A renewal change is already scheduled. Undo it before choosing a different plan."
        : "Plan changes are not available for this billing arrangement. You can review payment methods and invoices in Billing."}</p> : null}
    </div>
  );
}
