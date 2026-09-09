"use client";

import Link from "next/link";
import { Check } from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { CustomBundleCheckout, PlanCheckout, PortalButton } from "@/components/BillingActions";
import { CourseIcon, courseToneForBank } from "@/components/CourseIcon";
import type { ProductId } from "@/lib/access";
import { BANKS, type BankSlug } from "@/lib/banks";
import { getGraduatedBundlePrice, MAX_CUSTOM_BANKS } from "@/lib/custom-bundles";

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
  { name: "One Bank", label: "One question bank", monthly: "$6", annualMonthly: "$4", annual: "$48", annualSaving: "33%", description: "One subject. Full access.", mode: "single" as const, tone: "starter", popular: false },
  { name: "Build Your Plan", label: "One to five banks", monthly: "$6", annualMonthly: "$4", annual: "$48+", annualSaving: "33%", description: "Add only the banks you need.", mode: "builder" as const, tone: "builder", popular: true },
  { name: "All Access", label: "Every question bank", monthly: "$25", annualMonthly: "$18", annual: "$216", annualSaving: "28%", description: "Every bank. One subscription.", mode: "all" as const, tone: "premium", popular: false },
] as const;

type BillingInterval = "monthly" | "annual";

const ALL_ACCESS_MONTHLY_EQUIVALENT_CENTS = 2_500;
const ALL_ACCESS_ANNUAL_EQUIVALENT_CENTS = 1_800;
const ALL_ACCESS_ANNUAL_TOTAL_CENTS = 21_600;

function getBuilderMonthlyEquivalentCents(interval: BillingInterval, quantity: number): number | null {
  if (quantity === 0) return null;
  if (quantity > MAX_CUSTOM_BANKS) {
    return interval === "annual" ? ALL_ACCESS_ANNUAL_EQUIVALENT_CENTS : ALL_ACCESS_MONTHLY_EQUIVALENT_CENTS;
  }
  return getGraduatedBundlePrice(interval, quantity) / (interval === "annual" ? 12 : 1);
}

function getBuilderAnnualTotalCents(quantity: number): number | null {
  if (quantity === 0) return null;
  return quantity > MAX_CUSTOM_BANKS ? ALL_ACCESS_ANNUAL_TOTAL_CENTS : getGraduatedBundlePrice("annual", quantity);
}

function getBuilderAnnualSaving(quantity: number): string {
  if (quantity > MAX_CUSTOM_BANKS) return "28%";
  const monthlyTotalCents = getGraduatedBundlePrice("monthly", quantity) * 12;
  const annualTotalCents = getGraduatedBundlePrice("annual", quantity);
  return `${Math.round(((monthlyTotalCents - annualTotalCents) / monthlyTotalCents) * 100)}%`;
}

function formatCents(cents: number | null): string {
  return cents === null ? "$0" : `$${cents / 100}`;
}

function PlanArtwork({ tone }: { tone: (typeof PLANS)[number]["tone"] }) {
  if (tone === "starter") {
    return (
      <div className="plan-art plan-art-focus" aria-hidden="true">
        <span className="plan-art-orbit" />
        <span className="plan-art-focus-card"><strong>01</strong><small>BANK</small></span>
        <span className="plan-art-focus-dot" />
      </div>
    );
  }

  if (tone === "builder") {
    return (
      <div className="plan-art plan-art-build" aria-hidden="true">
        <span className="plan-art-rail" />
        <span className="plan-art-subject plan-art-subject-math">MATH</span>
        <span className="plan-art-subject plan-art-subject-chem">CHEM</span>
        <span className="plan-art-subject plan-art-subject-phys">PHYS</span>
        <span className="plan-art-subject plan-art-subject-bio">BIO</span>
      </div>
    );
  }

  return (
    <div className="plan-art plan-art-universe" aria-hidden="true">
      <span className="plan-art-premium-orbit plan-art-premium-orbit-outer" />
      <span className="plan-art-premium-orbit plan-art-premium-orbit-inner" />
      <span className="plan-art-all"><strong>12</strong><small>BANKS</small></span>
      {Array.from({ length: 8 }, (_, index) => <span className="plan-art-star" key={index} />)}
    </div>
  );
}

export function PricingContent({ authenticated, hasPaidAccess, currentPlanNames = [], initialInterval = "monthly", initialProductId, initialBankIds }: { authenticated: boolean; hasPaidAccess: boolean; currentPlanNames?: string[]; initialInterval?: BillingInterval; initialProductId?: ProductId; initialBankIds?: readonly BankSlug[] }) {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const initialBankId = initialProductId ? BANK_PRODUCT_TO_SLUG[initialProductId] : undefined;
  const initialCustomBankIds = initialBankIds ?? (initialBankId ? [initialBankId] : undefined);
  const [builderBankIds, setBuilderBankIds] = useState<BankSlug[]>(() => [...(initialCustomBankIds ?? [BANKS[0].slug])]);
  const handleBuilderSelectionChange = useCallback((selectedBankIds: readonly BankSlug[]) => {
    setBuilderBankIds([...selectedBankIds]);
  }, []);

  const renderPlan = (plan: (typeof PLANS)[number]) => {
    const isBuilder = plan.mode === "builder";
    const builderQuantity = builderBankIds.length;
    const builderHeadlineCents = isBuilder ? getBuilderMonthlyEquivalentCents(interval, builderQuantity) : null;
    const headlinePrice = isBuilder ? formatCents(builderHeadlineCents) : interval === "annual" ? plan.annualMonthly : plan.monthly;
    const builderAnnualTotalCents = isBuilder ? getBuilderAnnualTotalCents(builderQuantity) : null;
    const billingNote = isBuilder && builderQuantity === 0
      ? "Select banks to see your price."
      : interval === "annual"
        ? isBuilder
          ? `Billed ${formatCents(builderAnnualTotalCents)} once a year. Save ${getBuilderAnnualSaving(builderQuantity)}`
          : `Billed ${plan.annual} once a year. Save ${plan.annualSaving}`
        : "Billed monthly";

    return (
      <article className={`pricing-option${plan.popular ? " pricing-option-popular" : ""}`} data-plan-tone={plan.tone} data-mobile-order={plan.popular ? "first" : undefined} key={plan.name}>
        <div className="pricing-option-heading">
          <div><p className="plan-label">{plan.label}</p><h2>{plan.name}</h2></div>
          {plan.popular ? <span className="pricing-badge">Most popular</span> : null}
        </div>
        <div className="plan-price"><strong aria-live={isBuilder ? "polite" : undefined}>{headlinePrice}</strong><span>/ month</span></div>
        <p className="plan-billing-note">{billingNote}</p>
        <p className="plan-description">{plan.description}</p>
        <PlanArtwork tone={plan.tone} />
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
            initialBankIds={initialCustomBankIds}
            onSelectionChange={isBuilder ? handleBuilderSelectionChange : undefined}
          />
        )}
      </article>
    );
  };

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
