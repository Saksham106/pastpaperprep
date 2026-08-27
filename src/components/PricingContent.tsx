"use client";

import Link from "next/link";
import { Check } from "@phosphor-icons/react";
import { useState } from "react";
import { PlanCheckout, PortalButton } from "@/components/BillingActions";

const BANK_OPTIONS = [
  { productId: "bank_igcse", label: "Cambridge IGCSE Mathematics 0580" },
  { productId: "bank_igcse_additional", label: "Cambridge IGCSE Additional Mathematics 0606" },
  { productId: "bank_ib_hl", label: "IB Mathematics AA HL" },
  { productId: "bank_ib_sl", label: "IB Mathematics AA SL" },
  { productId: "bank_ib_ai_hl", label: "IB Mathematics AI HL" },
  { productId: "bank_ib_ai_sl", label: "IB Mathematics AI SL" },
] as const;

const PAIR_OPTIONS = [
  { productId: "bundle_igcse", label: "Cambridge IGCSE Maths (0580 + 0606)" },
  { productId: "bundle_ib_aa", label: "IB Mathematics AA (SL + HL)" },
  { productId: "bundle_ib_ai", label: "IB Mathematics AI (SL + HL)" },
] as const;

const PLANS = [
  { name: "One bank", label: "One course", monthly: "$5", annualMonthly: "$4", annual: "$48", annualSaving: "20%", description: "Choose any one question bank.", options: BANK_OPTIONS, popular: false },
  { name: "Subject pair", label: "Best for most students", monthly: "$8", annualMonthly: "$6", annual: "$72", annualSaving: "25%", description: "Choose IGCSE, IB AA, or IB AI.", options: PAIR_OPTIONS, popular: true },
  { name: "All banks", label: "Complete access", monthly: "$12", annualMonthly: "$8", annual: "$96", annualSaving: "33%", description: "Unlock all six question banks.", options: [{ productId: "bundle_all", label: "All banks" }] as const, popular: false },
] as const;

type BillingInterval = "monthly" | "annual";

export function PricingContent({ authenticated, hasPaidAccess, currentPlanNames = [] }: { authenticated: boolean; hasPaidAccess: boolean; currentPlanNames?: string[] }) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  return (
    <section className="simple-page pricing-page shell">
      <p className="eyebrow">Simple access</p>
      <h1>Choose how much maths you need.</h1>
      <p className="page-lede">Every paid plan includes the same practice tools. You only choose how many banks to unlock.</p>

      {authenticated ? (
        <section className="pricing-current-plan" aria-labelledby="current-plan-heading">
          <div><span className="eyebrow">Account</span><h2 id="current-plan-heading">Your current plan</h2></div>
          <div className="pricing-current-plan-details">
            <strong>{hasPaidAccess ? currentPlanNames.join(", ") || "Paid access" : "Free"}</strong>
            <span>{hasPaidAccess ? "Your access is active. Use billing to cancel or update payment details." : "Choose a plan below to unlock every available question."}</span>
          </div>
          {hasPaidAccess ? <PortalButton /> : null}
        </section>
      ) : null}

      <div className="billing-toggle" role="group" aria-label="Billing period">
        <button type="button" aria-pressed={interval === "monthly"} onClick={() => setInterval("monthly")}>Monthly</button>
        <button type="button" aria-pressed={interval === "annual"} onClick={() => setInterval("annual")}>Annual <span>Save up to 33%</span></button>
      </div>

      <div className="pricing-options" aria-label="PastPaperPrep plans">
        {PLANS.map((plan) => (
          <article className={`pricing-option${plan.popular ? " pricing-option-popular" : ""}`} data-mobile-order={plan.popular ? "first" : undefined} key={plan.name}>
            <div className="pricing-option-heading">
              <div><p className="plan-label">{plan.label}</p><h2>{plan.name}</h2></div>
              {plan.popular ? <span className="pricing-badge">Most popular</span> : null}
            </div>
            <div className="plan-price"><strong>{interval === "annual" ? plan.annualMonthly : plan.monthly}</strong><span>/ month</span></div>
            {interval === "annual" ? <p className="plan-billing-note">Billed {plan.annual} once a year · Save {plan.annualSaving}</p> : <p className="plan-billing-note">Billed monthly</p>}
            <p className="plan-description">{plan.description}</p>
            <PlanCheckout options={plan.options} interval={interval} authenticated={authenticated} hasPaidAccess={hasPaidAccess} />
          </article>
        ))}
      </div>

      <div className="pricing-free-strip">
        <div><strong>Not ready to pay?</strong><span>Practise complete older exam years for free.</span></div>
        {hasPaidAccess ? <span className="plan-status">Paid access is active</span> : <Link className="button secondary" href="/banks/igcse?free=1">Browse free questions</Link>}
      </div>

      <div className="pricing-includes-compact" aria-label="Included with every paid plan">
        <span><Check /> All available questions</span>
        <span><Check /> Answers and mark schemes where available</span>
        <span><Check /> Smart filters</span>
        <span><Check /> PDF export</span>
      </div>

      <p className="checkout-note">Secure Stripe checkout. Cancel any time. Existing All-Access subscribers keep their current price.</p>
    </section>
  );
}