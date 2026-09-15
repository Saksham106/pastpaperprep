"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Check, CrownSimple, SlidersHorizontal } from "@phosphor-icons/react";
import { useCallback, useState } from "react";
import { CustomBundleCheckout, PlanCheckout, PortalButton } from "@/components/BillingActions";
import { CourseIcon, courseToneForBank } from "@/components/CourseIcon";
import type { ProductId } from "@/lib/access";
import { bankEntryHref, hasFreeTier } from "@/lib/access";
import { type Bank, type BankSlug } from "@/lib/banks";
import { getGraduatedBundlePrice } from "@/lib/custom-bundles";
import { getCatalogBanksForDisplay, getCatalogRuntimeBanks } from "@/lib/catalog";
import { PRICING_MODEL } from "@/lib/pricing-model";
import { annualSavingPercent, formatPrice, maximumAnnualSavingPercent, priceForBankCount } from "@/lib/pricing-model";
import { QualificationTabs } from "@/components/QualificationTabs";

function bankSlugForProduct(productId: string): BankSlug | undefined {
  return getCatalogBanksForDisplay().find((bank) => bank.productId === productId)?.slug;
}

const PLANS = [
  {
    name: "One Bank", label: PRICING_MODEL.oneBank.label, monthly: formatPrice(PRICING_MODEL.oneBank.monthlyCents), annualMonthly: formatPrice(PRICING_MODEL.oneBank.annualCents / 12), annual: formatPrice(PRICING_MODEL.oneBank.annualCents), annualSaving: `${annualSavingPercent(PRICING_MODEL.oneBank.monthlyCents, PRICING_MODEL.oneBank.annualCents)}%`,
    description: "Focus on one syllabus.", mode: "single" as const, tone: "starter", artwork: "/artwork/aristotle-tutoring-alexander.jpg", popular: false, icon: BookOpen, cta: "Choose One Bank",
  },
  {
    name: "Build Your Plan", label: `${PRICING_MODEL.builder.minBanks} to ${PRICING_MODEL.builder.maxBanks} banks`, monthly: formatPrice(PRICING_MODEL.builder.baseMonthlyCents), annualMonthly: formatPrice(PRICING_MODEL.builder.baseAnnualCents / 12), annual: `${formatPrice(PRICING_MODEL.builder.baseAnnualCents)}+`, annualSaving: `${annualSavingPercent(PRICING_MODEL.builder.baseMonthlyCents, PRICING_MODEL.builder.baseAnnualCents)}%`,
    description: "Mix the banks you actually take.", mode: "builder" as const, tone: "builder", artwork: "/artwork/school-of-athens-plato-aristotle.jpg", popular: true, icon: SlidersHorizontal, cta: "Build Your Plan",
  },
  {
    name: "All Access", label: PRICING_MODEL.allAccess.label, monthly: formatPrice(PRICING_MODEL.allAccess.monthlyCents), annualMonthly: formatPrice(PRICING_MODEL.allAccess.annualCents / 12), annual: formatPrice(PRICING_MODEL.allAccess.annualCents), annualSaving: `${annualSavingPercent(PRICING_MODEL.allAccess.monthlyCents, PRICING_MODEL.allAccess.annualCents)}%`,
    description: "Everything, including future banks.", mode: "all" as const, tone: "premium", artwork: "/artwork/plato-academy-mosaic.jpg", popular: false, icon: CrownSimple, cta: "Get All Access",
  },
] as const;

type BillingInterval = "monthly" | "annual";

function getBuilderMonthlyEquivalentCents(interval: BillingInterval, quantity: number): number | null {
  if (quantity < 2) return null;
  if (quantity >= PRICING_MODEL.allAccess.minBanks) return interval === "annual" ? PRICING_MODEL.allAccess.annualCents / 12 : PRICING_MODEL.allAccess.monthlyCents;
  return getGraduatedBundlePrice(interval, quantity) / (interval === "annual" ? 12 : 1);
}

function getBuilderAnnualTotalCents(quantity: number): number | null {
  if (quantity < 2) return null;
  return quantity >= PRICING_MODEL.allAccess.minBanks ? PRICING_MODEL.allAccess.annualCents : getGraduatedBundlePrice("annual", quantity);
}

function getBuilderAnnualSaving(quantity: number): string {
  const effectiveQuantity = Math.max(PRICING_MODEL.builder.minBanks, quantity);
  return `${annualSavingPercent(priceForBankCount("monthly", effectiveQuantity), priceForBankCount("annual", effectiveQuantity))}%`;
}

function formatCents(cents: number | null): string {
  return cents === null ? formatPrice(0) : formatPrice(cents);
}

function BankTable({ banks }: { banks: readonly Bank[] }) {
  return <div className="pricing-bank-table-wrap"><table className="pricing-bank-table" aria-label="Question bank coverage"><thead><tr><th scope="col">Question bank</th><th scope="col">Questions</th><th scope="col">Papers</th><th scope="col">Coverage</th><th scope="col"><span className="sr-only">Preview</span></th></tr></thead><tbody>{banks.map((bank) => { const tone = courseToneForBank(bank); const free = hasFreeTier(bank.slug); return <tr className={`course-tone-${tone}`} data-pricing-bank={bank.slug} data-has-free-tier={free ? "true" : undefined} key={bank.slug}><th scope="row"><div className="pricing-bank-name"><CourseIcon tone={tone} /><div><span>{bank.qualification}</span><strong>{bank.shortName}</strong></div></div></th><td data-label="Questions">{bank.questionCount.toLocaleString()}</td><td data-label="Papers">{bank.paperCount}</td><td data-label="Coverage">{bank.years}</td><td className="pricing-bank-preview">{free ? <Link href={bankEntryHref(bank.slug)} aria-label={`Preview ${bank.shortName}`}>Preview</Link> : <span className="pricing-bank-no-preview" aria-hidden="true">-</span>}</td></tr>; })}</tbody></table></div>;
}

export function PricingContent({ authenticated, hasPaidAccess, currentPlanNames = [], initialInterval = "monthly", initialProductId, initialBankIds, availableBanks = getCatalogRuntimeBanks() }: { authenticated: boolean; hasPaidAccess: boolean; currentPlanNames?: string[]; initialInterval?: BillingInterval; initialProductId?: ProductId; initialBankIds?: readonly BankSlug[]; availableBanks?: readonly Bank[] }) {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const initialBankId = initialProductId ? bankSlugForProduct(initialProductId) : undefined;
  const initialCustomBankIds = initialBankIds ?? (initialBankId ? [initialBankId] : undefined);
  const [builderBankIds, setBuilderBankIds] = useState<BankSlug[]>(() => [...(initialCustomBankIds ?? [])]);
  const handleBuilderSelectionChange = useCallback((selectedBankIds: readonly BankSlug[]) => {
    setBuilderBankIds([...selectedBankIds]);
  }, []);

  const renderPlan = (plan: (typeof PLANS)[number]) => {
    const PlanIcon = plan.icon;
    const isBuilder = plan.mode === "builder";
    const builderQuantity = builderBankIds.length;
    const builderHeadlineCents = isBuilder ? getBuilderMonthlyEquivalentCents(interval, builderQuantity) : null;
    const headlinePrice = isBuilder
      ? builderHeadlineCents === null
        ? interval === "annual" ? plan.annualMonthly : plan.monthly
        : formatCents(builderHeadlineCents)
      : interval === "annual" ? plan.annualMonthly : plan.monthly;
    const builderAnnualTotalCents = isBuilder ? getBuilderAnnualTotalCents(builderQuantity) : null;
    const checkoutCta = isBuilder
      ? `Continue with ${builderQuantity} ${builderQuantity === 1 ? "bank" : "banks"}`
      : plan.cta;
    const billingNote = isBuilder && builderQuantity < 2
      ? "Two-bank minimum. Select banks to see your exact price."
      : interval === "annual"
        ? isBuilder
          ? `Billed ${formatCents(builderAnnualTotalCents)} once a year. Save ${getBuilderAnnualSaving(builderQuantity)}`
          : `Billed ${plan.annual} once a year. Save ${plan.annualSaving}`
        : "Billed monthly";

    return (
      <article className={`pricing-option${plan.popular ? " pricing-option-popular" : ""}`} data-plan-tone={plan.tone} data-mobile-order={plan.popular ? "first" : undefined} key={plan.name}>
        <Image className="plan-art" src={plan.artwork} alt="" width={420} height={260} aria-hidden="true" />
        <div className="pricing-option-heading">
          <div className="plan-title-block">
            <span className="plan-icon" aria-hidden="true"><PlanIcon weight="duotone" /></span>
            <div><p className="plan-label">{plan.label}</p><h2>{plan.name}</h2></div>
          </div>
          {plan.popular ? <span className="pricing-badge">Most popular</span> : null}
        </div>
        <div className="plan-price"><strong aria-live={isBuilder ? "polite" : undefined}>{headlinePrice}</strong><span>/ month</span></div>
        <p className="plan-billing-note">{billingNote}</p>
        <p className="plan-description">{plan.description}</p>
        {plan.mode === "all" ? (
          <PlanCheckout
            options={[{ productId: "bundle_all", label: "All Access" }]}
            interval={interval}
            authenticated={authenticated}
            hasPaidAccess={hasPaidAccess}
            ctaLabel={checkoutCta}
          />
        ) : (
          <CustomBundleCheckout
            mode={plan.mode}
            interval={interval}
            authenticated={authenticated}
            hasPaidAccess={hasPaidAccess}
            initialBankIds={initialCustomBankIds}
            availableBanks={availableBanks}
            onSelectionChange={isBuilder ? handleBuilderSelectionChange : undefined}
            ctaLabel={checkoutCta}
          />
        )}
      </article>
    );
  };

  return (
    <section className="simple-page pricing-page shell">
      <div className="pricing-intro">
        <p className="eyebrow">PastPaperPrep pricing</p>
        <h1 aria-label="Pay only for what you study.">Pay only for what you study.</h1>
        <p className="page-lede">Choose the question banks you need. Every plan includes the same study tools.</p>
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
        <button className="billing-toggle-annual" type="button" aria-pressed={interval === "annual"} onClick={() => setInterval("annual")}>Annual <span className="billing-savings">Save up to {maximumAnnualSavingPercent()}%</span></button>
      </div>

      <div className="pricing-decision-grid" aria-label="PastPaperPrep plans">
        {PLANS.map(renderPlan)}
      </div>

      <div className="pricing-free-strip">
        <div><strong>Not ready to pay?</strong><span>Practise complete older exam years for free.</span></div>
        {hasPaidAccess ? <span className="plan-status">Paid access is active</span> : <Link className="button secondary" href={bankEntryHref("igcse")}>Browse free questions</Link>}
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
        <QualificationTabs className="pricing-qualification-tabs" items={[
          { id: "pricing-cambridge", label: "Cambridge IGCSE", panel: <BankTable banks={availableBanks.filter((bank) => bank.qualification === "Cambridge IGCSE")} /> },
          { id: "pricing-ib", label: "IB Diploma", panel: <BankTable banks={availableBanks.filter((bank) => bank.qualification === "International Baccalaureate")} /> },
        ].filter((item) => item.panel.props.banks.length > 0)} />
      </section>

      <p className="checkout-note">Secure Stripe checkout. Cancel any time. Existing subscribers remain grandfathered at their current price and access.</p>
    </section>
  );
}
