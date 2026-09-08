"use client";

import Link from "next/link";
import { Check } from "@phosphor-icons/react";
import { useState } from "react";
import { PlanCheckout, PortalButton } from "@/components/BillingActions";
import { CourseIcon, courseToneForBank } from "@/components/CourseIcon";
import type { ProductId } from "@/lib/access";
import { BANKS } from "@/lib/banks";

const BANK_OPTIONS = [
  { productId: "bank_igcse", label: "Cambridge IGCSE Mathematics 0580" },
  { productId: "bank_igcse_additional", label: "Cambridge IGCSE Additional Mathematics 0606" },
  { productId: "bank_ib_hl", label: "IB Mathematics AA HL" },
  { productId: "bank_ib_sl", label: "IB Mathematics AA SL" },
  { productId: "bank_ib_ai_hl", label: "IB Mathematics AI HL" },
  { productId: "bank_ib_ai_sl", label: "IB Mathematics AI SL" },
  { productId: "bank_ib_chemistry_hl", label: "IB Chemistry HL" },
  { productId: "bank_ib_chemistry_sl", label: "IB Chemistry SL" },
  { productId: "bank_ib_physics_hl", label: "IB Physics HL" },
  { productId: "bank_ib_physics_sl", label: "IB Physics SL" },
  { productId: "bank_ib_biology_hl", label: "IB Biology HL" },
  { productId: "bank_ib_biology_sl", label: "IB Biology SL" },
] as const;

const PAIR_OPTIONS = [
  { productId: "bundle_igcse", label: "Cambridge IGCSE Maths (0580 + 0606)" },
  { productId: "bundle_ib_aa", label: "IB Mathematics AA (SL + HL)" },
  { productId: "bundle_ib_ai", label: "IB Mathematics AI (SL + HL)" },
  { productId: "bundle_ib_chemistry", label: "IB Chemistry (SL + HL)" },
  { productId: "bundle_ib_physics", label: "IB Physics (SL + HL)" },
  { productId: "bundle_ib_biology", label: "IB Biology (SL + HL)" },
] as const;

const PLANS = [
  { name: "One bank", label: "Single bank", monthly: "$5", annualMonthly: "$4", annual: "$48", annualSaving: "20%", description: "Choose any one question bank.", options: BANK_OPTIONS, popular: false },
  { name: "Subject pair", label: "Two banks", monthly: "$8", annualMonthly: "$6", annual: "$72", annualSaving: "25%", description: "Get both banks in IGCSE, IB AA, IB AI, IB Chemistry, IB Physics, or IB Biology.", options: PAIR_OPTIONS, popular: true },
  { name: "All banks", label: "Twelve banks", monthly: "$12", annualMonthly: "$8", annual: "$96", annualSaving: "33%", description: "Unlock all twelve question banks.", options: [{ productId: "bundle_all", label: "All banks" }] as const, popular: false },
] as const;

type BillingInterval = "monthly" | "annual";

export function PricingContent({ authenticated, hasPaidAccess, currentPlanNames = [], initialInterval = "monthly", initialProductId }: { authenticated: boolean; hasPaidAccess: boolean; currentPlanNames?: string[]; initialInterval?: BillingInterval; initialProductId?: ProductId }) {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);

  const renderPlan = (plan: (typeof PLANS)[number]) => (
    <article className={`pricing-option${plan.popular ? " pricing-option-popular" : ""}`} data-mobile-order={plan.popular ? "first" : undefined} key={plan.name}>
      <div className="pricing-option-heading">
        <div><p className="plan-label">{plan.label}</p><h2>{plan.name}</h2></div>
        {plan.popular ? <span className="pricing-badge">Most popular</span> : null}
      </div>
      <div className="plan-price"><strong>{interval === "annual" ? plan.annualMonthly : plan.monthly}</strong><span>/ month</span></div>
      {interval === "annual" ? <p className="plan-billing-note">Billed {plan.annual} once a year. Save {plan.annualSaving}</p> : <p className="plan-billing-note">Billed monthly</p>}
      <p className="plan-description">{plan.description}</p>
      <PlanCheckout options={plan.options} interval={interval} authenticated={authenticated} hasPaidAccess={hasPaidAccess} initialProductId={initialProductId} />
    </article>
  );

  return (
    <section className="simple-page pricing-page shell">
      <div className="pricing-intro">
        <p className="eyebrow">Pricing</p>
        <h1>Pay only for the subjects you actually study.</h1>
        <p className="page-lede">Every paid plan has the same study tools. Choose how many banks you need.</p>
      </div>

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
        <button className="billing-toggle-annual" type="button" aria-pressed={interval === "annual"} onClick={() => setInterval("annual")}>Annual <span className="billing-savings">Save up to 33%</span></button>
      </div>

      <div className="pricing-decision-grid" aria-label="PastPaperPrep plans">
        {PLANS.map(renderPlan)}
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

      <section className="pricing-bank-catalog" aria-labelledby="pricing-bank-catalog-heading">
        <div className="pricing-bank-catalog-heading">
          <div>
            <p className="eyebrow">What you get</p>
            <h2 id="pricing-bank-catalog-heading">Compare every question bank</h2>
          </div>
          <p>See the real coverage behind each choice before you pay.</p>
        </div>
        <div className="pricing-bank-grid">
          {BANKS.map((bank) => {
            const tone = courseToneForBank(bank);
            return (
              <article className={`pricing-bank-card course-tone-${tone}`} data-pricing-bank={bank.slug} key={bank.slug}>
                <div className="pricing-bank-card-heading">
                  <CourseIcon tone={tone} />
                  <div><span>{bank.qualification}</span><h3>{bank.shortName}</h3></div>
                </div>
                <dl>
                  <div><dt>Questions</dt><dd>{bank.questionCount.toLocaleString()}</dd></div>
                  <div><dt>Papers</dt><dd>{bank.paperCount}</dd></div>
                  <div><dt>Coverage</dt><dd>{bank.years.replace("-", "–")}</dd></div>
                </dl>
                <Link href={`/banks/${bank.slug}?free=1`}>Preview this bank</Link>
              </article>
            );
          })}
        </div>
      </section>

      <p className="checkout-note">Secure Stripe checkout. Cancel any time. Existing All-Access subscribers keep their current price.</p>
    </section>
  );
}