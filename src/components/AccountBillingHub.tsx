"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AccountBillingDetails, type BillingLoadState } from "./AccountBillingDetails";
import { PortalButton } from "./BillingActions";
export type HubAccess = "complimentary" | "lifetime" | "manual";
export function AccountBillingHub({ access, previewState }: { access?: HubAccess; previewState?: BillingLoadState }) {
 const [liveState, setLiveState] = useState<BillingLoadState>({kind:"loading"});
 const state = previewState ?? liveState;
 const reload = useCallback(async (signal?: AbortSignal) => {
  if (previewState) return;
  try {
   const response = await fetch("/api/billing/subscription", {cache:"no-store", signal});
   if (signal?.aborted) return;
   if (response.status === 404) { setLiveState({kind:"none"}); return; }
   if (!response.ok) throw new Error("Billing could not be verified");
   const data = await response.json();
   if (!Array.isArray(data.subscriptions) || !Array.isArray(data.invoices) || typeof data.management?.editable !== "boolean") throw new Error("Invalid billing snapshot");
   if (!signal?.aborted) setLiveState({kind:"loaded",data});
  } catch { if (!signal?.aborted) setLiveState({kind:"error"}); }
 }, [previewState]);
 useEffect(() => { if (previewState) return; const controller=new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void reload(controller.signal); }); return () => controller.abort(); }, [previewState,reload]);
 const readOnly = previewState !== undefined;
 const current = state.kind === "loaded" ? state.data.subscriptions.filter(s => s.status !== "canceled" && s.status !== "incomplete_expired") : [];
 const canChange = state.kind === "loaded" && state.data.management.editable && current.length === 1 && current[0].status === "active" && access !== "complimentary" && access !== "lifetime";
 const noSubscription = state.kind === "none" || state.kind === "loaded" && current.length === 0;
 return <section className="account-section-page account-billing-hub">
  <header className="account-hub-header"><div><p className="eyebrow">Your account</p><h1>Subscription &amp; billing</h1><p className="account-hub-lede">Your access and payments, in one place.</p></div><Link className="button primary account-hub-pricing" href="/pricing">{canChange ? "Change plan" : "Compare plans"} <span aria-hidden="true">↗</span></Link></header>
  <section id="subscription" aria-labelledby="subscription-heading" className="account-hub-section"><div className="account-hub-section-heading"><span aria-hidden="true">01</span><h2 id="subscription-heading">Subscription</h2><p>What you can access, and what renews.</p></div>
   {access ? <div className="account-hub-access"><div><span className="account-hub-status">Active</span><h3>{access === "complimentary" ? "Complimentary All Access" : access === "lifetime" ? "Lifetime All Access" : "Complimentary access"}</h3><p>{access === "manual" ? "A manual grant covers selected question banks." : "Every question bank is included."}</p><p className="account-hub-access-note">{access === "lifetime" ? "One-time access. No subscription renewal is needed for this grant." : "Manual access grant, not a billed subscription."}{current.length > 0 ? " Your separate paid subscriptions are shown below." : ""}</p></div><Link className="account-hub-text-link" href="/dashboard">Browse question banks <span aria-hidden="true">↗</span></Link></div> : null}
   {noSubscription ? !access ? <div className="account-hub-empty"><h3>No paid subscription</h3><p>Browse free questions, or compare plans for more access.</p><Link className="account-hub-text-link" href="/dashboard">Browse question banks ↗</Link></div> : null : <AccountBillingDetails mode="subscription" providedState={state} readOnly={readOnly} onReload={() => void reload()} complimentaryAllAccess={access === "complimentary"} showPlanEditor={false} />}
  </section>
  <section id="billing" aria-labelledby="billing-heading" className="account-hub-section"><div className="account-hub-section-heading"><span aria-hidden="true">02</span><h2 id="billing-heading">Billing</h2><p>Payment methods, invoices, and receipts.</p></div>
   {state.kind === "loaded" ? <><div className="account-hub-portal"><div><h3>Secure billing portal</h3><p>Update payment details or see your complete invoice history. Card details stay with Stripe.</p></div>{readOnly ? <button className="button secondary" type="button" disabled>Manage billing</button> : <PortalButton />}</div><AccountBillingDetails mode="billing" providedState={state} readOnly={readOnly} /></> : state.kind === "none" ? <div className="account-hub-empty"><h3>No billing account connected</h3><p>No payment method or invoices to display.{access ? " Your granted access is separate from billing." : " Billing details will appear here after your first purchase."}</p></div> : state.kind === "error" ? <p role="alert" className="account-billing-warning">We couldn’t verify your billing details. This does not mean your subscription was cancelled.</p> : <p role="status">Loading billing details…</p>}
  </section>
  <p className="account-hub-footer-note">Choose or change plans on Pricing. Manage your access and payments here.</p>
 </section>;
}
