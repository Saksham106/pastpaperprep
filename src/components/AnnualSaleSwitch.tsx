"use client";

import { useState } from "react";
import { ANNUAL_SALE, ANNUAL_SALE_MAX_PERCENT, formatSaleCents } from "@/lib/annual-sale";
import { trackProductEvent } from "@/lib/product-analytics";
import { useAnnualSaleLive } from "@/components/useAnnualSaleLive";

type Estimate = { amountDueTodayCents: number; creditCents: number; taxesCents: number; accountCreditCents?: number; firstYearCents: number; renewsAtCents: number; percentOff: number; currency: string };
type Quote = { estimate: Estimate; snapshot: Record<string, unknown> };

async function post(body: unknown) {
  const response = await fetch("/api/billing/subscription/annual-switch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(data.code === "SALE_UNAVAILABLE"
      ? "The sale price isn’t available right now. Try again in a few minutes."
      : typeof data.error === "string" ? data.error : "Couldn’t switch to annual. Nothing has changed.");
  }
  return data;
}

/**
 * Monthly subscribers during the annual sale: switch to annual now at the sale price, same banks.
 * Quote first (nothing changes), then confirm; the plan turns annual only if the payment succeeds.
 */
export function AnnualSaleSwitch({ disabled = false, onUpdated }: { disabled?: boolean; onUpdated: (message?: string) => void }) {
  const live = useAnnualSaleLive();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Card declined or waiting on 3D Secure: the plan is still monthly until this invoice is paid.
  const [pending, setPending] = useState<{ payUrl: string | null } | null>(null);
  if (!live) return null;

  async function preview() {
    setBusy(true); setError(null);
    try {
      const data = await post({ intent: "preview" }) as unknown as Quote;
      if (!data.estimate || !data.snapshot || !Number.isSafeInteger(data.estimate.amountDueTodayCents)) throw new Error("Couldn’t get a price. Nothing has changed.");
      setQuote(data);
      trackProductEvent("annual_switch_preview", { percentOff: data.estimate.percentOff });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t get a price. Nothing has changed."); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!quote) return;
    setBusy(true); setError(null);
    try {
      const data = await post({ intent: "confirm", snapshot: quote.snapshot });
      trackProductEvent("annual_switch_confirm", { percentOff: quote.estimate.percentOff, status: String(data.status) });
      setQuote(null);
      if (data.status === "pending") {
        const payUrl = typeof data.payUrl === "string" && data.payUrl.startsWith("https://invoice.stripe.com/") ? data.payUrl : null;
        setPending({ payUrl });
        return;
      }
      onUpdated(`You’re on annual now: ${formatSaleCents(quote.estimate.amountDueTodayCents)} charged today. It renews at ${formatSaleCents(quote.estimate.renewsAtCents)}/yr.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t switch to annual. Nothing has changed."); }
    finally { setBusy(false); }
  }

  const estimate = quote?.estimate;
  return <section className="annual-switch-offer" aria-labelledby="annual-switch-heading">
    <p className="plan-sale-tag">{ANNUAL_SALE.name} · ends {ANNUAL_SALE.endLabel}</p>
    <h3 id="annual-switch-heading">Switch to annual and save up to {ANNUAL_SALE_MAX_PERCENT}% on your first year</h3>
    {pending ? <p role="status" className="annual-switch-price">Your payment hasn’t gone through yet, so your plan is still monthly.{" "}
      {pending.payUrl ? <a href={pending.payUrl} target="_blank" rel="noopener noreferrer">Finish payment</a> : "Check Billing to finish paying."} The sale price is held for about a day.</p>
    : estimate ? <>
      <p className="annual-switch-price"><strong>{formatSaleCents(estimate.amountDueTodayCents)} today</strong> for a full year of your current banks ({estimate.percentOff}% off).</p>
      <p className="annual-switch-detail">{formatSaleCents(estimate.firstYearCents)} for the year, minus {formatSaleCents(estimate.creditCents)} for the rest of this month{estimate.taxesCents ? `, plus ${formatSaleCents(estimate.taxesCents)} tax` : ""}{estimate.accountCreditCents ? `, minus ${formatSaleCents(estimate.accountCreditCents)} account credit` : ""}. Then {formatSaleCents(estimate.renewsAtCents)}/yr.</p>
      <div className="annual-switch-actions">
        <button type="button" className="button primary" disabled={busy || disabled} onClick={confirm}>{busy ? "Switching…" : `Pay ${formatSaleCents(estimate.amountDueTodayCents)} and switch`}</button>
        <button type="button" className="button secondary" disabled={busy} onClick={() => setQuote(null)}>Not now</button>
      </div>
    </> : <div className="annual-switch-actions">
      <button type="button" className="button primary" disabled={busy || disabled} onClick={preview}>{busy ? "Checking…" : "See my price"}</button>
    </div>}
    {error ? <p role="alert" className="account-billing-warning">{error}</p> : null}
  </section>;
}
