"use client";

import Link from "next/link";
import { Check } from "@phosphor-icons/react";
import { useState } from "react";
import { CustomBundleCheckout, PlanCheckout, PortalButton } from "@/components/BillingActions";
import { CourseIcon, courseToneForBank } from "@/components/CourseIcon";
import type { ProductId } from "@/lib/access";
import { BANKS, type BankSlug } from "@/lib/banks";

const BANK_PRODUCT_TO_SLUG: Record<string, BankSlug> = {
  bank_igcse: "igcse",
  bank_igcse_additional: "igcse-additional",
  bank_ib_hl: "ib-hl",
  bank_ib_sl: "ib-sl",
  bank_ib_ai_hl: "ib-ai-hl",
  bank_ib_ai_sl: "ib-ai-sl",
  bank_ib_chemistry_hl: "ib-chemistry-hl",
  bank_ib_chemistry_sl: "ib-chemistry-sl",
  bank_ib_physics_hl: "ib-physics-hl",
  bank_ib_physics_sl: "ib-physics-sl",
  bank_ib_biology_hl: "ib-biology-hl",
  bank_ib_biology_sl: "ib-biology-sl",
};

const PLANS = [
  { name: "One Bank", label: "One question bank", monthly: "$6", annualMonthly: "$4", annual: "$48", annualSaving: "33%", description: "Choose exactly one question bank and pay only for it.", mode: "single" as const, popular: false },
  { name: "Build Your Plan", label: "One to five banks", monthly: "$6", annualMonthly: "$4", annual: "$48+", annualSaving: "33%", description: "Select the exact banks you need. The first bank is $6/month, then $4 for each additional bank.", mode: "builder" as const, popular: true },
  { name: "All Access", label: "Every question bank", monthly: "$25", annualMonthly: "$18", annual: "$216", annualSaving: "28%", description: "Unlock every current bank and every bank added during your subscription.", mode: "all" as const, popular: false },
] as const;

type BillingInterval = "monthly" | "annual";

export function PricingContent({ authenticated, hasPaidAccess, currentPlanNames = [], initialInterval = "monthly", initialProductId, initialBankIds }: { authenticated: boolean; hasPaidAccess: boolean; currentPlanNames?: string[]; initialInterval?: BillingInterval; initialProductId?: ProductId; initialBankIds?: readonly BankSlug[] }) {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const initialBankId = initialProductId ? BANK_PRODUCT_TO_SLUG[initialProductId] : undefined;

  const renderPlan = (plan: (typeof PLANS)[number]) => (
    <article className={`pricing-option${plan.popular ? " pricing-option-popular" : ""}`} data-mobile-order={plan.popular ? "first" : undefined} key={plan.name}>
      <div className="pricing-option-heading">
        <div><p className="plan-label">{plan.label}</p><h2>{plan.name}</h2></div>
        {plan.popular ? <span className="pricing-badge">Most popular</span> : null}
      </div>
      <div className="plan-price"><strong>{interval === "annual" ? plan.annualMonthly : plan.monthly}</strong><span>/ month</span></div>
      {interval === "annual" ? <p className="plan-billing-note">Billed {plan.annual} once a year. Save {plan.annualSaving}</p> : <p className="plan-billing-note">Billed monthly</p>}
      <p className="plan-description">{plan.description}</p>
      {plan.mode === "all" ? (
        <PlanCheckout
          options={[{ productId: "bundle_all", label: "All Access" }]}
          interval={interval}
          authenticated={authenticated}
          hasPaidAccess={hasPaidAccess}
        />
      ) : (
        <CustomBundleCheckout
          mode={plan.mode}
          interval={interval}
          authenticated={authenticated}
          hasPaidAccess={hasPaidAccess}
          initialBankIds={initialBankIds ?? (initialBankId ? [initialBankId] : undefined)}
        />
      )}
    </article>
  );

  return (
    <section className="simple-page pricing-page shell">
      <div className="pricing-intro">
        <p className="eyebrow">Pricing</p>
        <h1>Pay only for the subjects you actually study.</h1>
        <p className="page-lede">Every paid plan has the same study tools. Choose one bank, build an exact bundle, or unlock everything.</p>
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
        <div className="pricing-bank-table-wrap">
          <table className="pricing-bank-table" aria-label="Question bank coverage">
            <thead>
              <tr><th scope="col">Question bank</th><th scope="col">Questions</th><th scope="col">Papers</th><th scope="col">Coverage</th><th scope="col"><span className="sr-only">Preview</span></th></tr>
            </thead>
            <tbody>
              {BANKS.map((bank) => {
                const tone = courseToneForBank(bank);
                return (
                  <tr className={`course-tone-${tone}`} data-pricing-bank={bank.slug} key={bank.slug}>
                    <th scope="row">
                      <div className="pricing-bank-name">
                        <CourseIcon tone={tone} />
                        <div><span>{bank.qualification}</span><strong>{bank.shortName}</strong></div>
                      </div>
                    </th>
                    <td data-label="Questions">{bank.questionCount.toLocaleString()}</td>
                    <td data-label="Papers">{bank.paperCount}</td>
                    <td data-label="Coverage">{bank.years.replace("-", "–")}</td>
                    <td className="pricing-bank-preview"><Link href={`/banks/${bank.slug}?free=1`} aria-label={`Preview ${bank.shortName}`}>Preview</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="checkout-note">Secure Stripe checkout. Cancel any time. Existing fixed and All-Access subscribers remain grandfathered at their current price.</p>
    </section>
  );
}
