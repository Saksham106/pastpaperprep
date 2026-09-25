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
import { getCatalogBank, getCatalogBanksForDisplay, getCatalogRuntimeBanks } from "@/lib/catalog";
import { PRICING_MODEL } from "@/lib/pricing-model";
import { trackProductEvent } from "@/lib/product-analytics";
import { annualSavingPercent, formatPrice, maximumAnnualSavingPercent, priceForBankCount } from "@/lib/pricing-model";
import { QualificationTabs } from "@/components/QualificationTabs";

function bankSlugForProduct(productId: string): BankSlug | undefined {
  return getCatalogBanksForDisplay().find((bank) => bank.productId === productId)?.slug;
}

const PLANS = [
  {
    name: "One Bank", label: PRICING_MODEL.oneBank.label, monthly: formatPrice(PRICING_MODEL.oneBank.monthlyCents), annualMonthly: formatPrice(PRICING_MODEL.oneBank.annualCents / 12), annual: formatPrice(PRICING_MODEL.oneBank.annualCents), annualSaving: `${annualSavingPercent(PRICING_MODEL.oneBank.monthlyCents, PRICING_MODEL.oneBank.annualCents)}%`,
    description: "Focus on one syllabus.", mode: "single" as const, tone: "starter", artwork: "/artwork/aristotle-tutoring-alexander.webp", popular: false, icon: BookOpen, cta: "Choose One Bank",
  },
  {
    name: "Build Your Plan", label: `${PRICING_MODEL.builder.minBanks} to ${PRICING_MODEL.builder.maxBanks} banks`, monthly: formatPrice(PRICING_MODEL.builder.baseMonthlyCents), annualMonthly: formatPrice(PRICING_MODEL.builder.baseAnnualCents / 12), annual: `${formatPrice(PRICING_MODEL.builder.baseAnnualCents)}+`, annualSaving: `${annualSavingPercent(PRICING_MODEL.builder.baseMonthlyCents, PRICING_MODEL.builder.baseAnnualCents)}%`,
    description: "Mix the banks you actually take.", mode: "builder" as const, tone: "builder", artwork: "/artwork/school-of-athens-plato-aristotle.webp", popular: true, icon: SlidersHorizontal, cta: "Build Your Plan",
  },
  {
    name: "All Access", label: PRICING_MODEL.allAccess.label, monthly: formatPrice(PRICING_MODEL.allAccess.monthlyCents), annualMonthly: formatPrice(PRICING_MODEL.allAccess.annualCents / 12), annual: formatPrice(PRICING_MODEL.allAccess.annualCents), annualSaving: `${annualSavingPercent(PRICING_MODEL.allAccess.monthlyCents, PRICING_MODEL.allAccess.annualCents)}%`,
    description: "Everything, including future banks.", mode: "all" as const, tone: "premium", artwork: "/artwork/plato-academy-mosaic.webp", popular: false, icon: CrownSimple, cta: "Unlock all banks",
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

export function PricingContent({ authenticated, hasPaidAccess, currentPlanNames = [], currentPlanProductIds = [], complimentaryAccess = false, previewOnly = false, ownedBankIds = [], initialInterval = "monthly", initialProductId, initialBankIds, availableBanks = getCatalogRuntimeBanks() }: { authenticated: boolean; hasPaidAccess: boolean; currentPlanNames?: string[]; currentPlanProductIds?: readonly ProductId[]; complimentaryAccess?: boolean; previewOnly?: boolean; ownedBankIds?: readonly BankSlug[]; initialInterval?: BillingInterval; initialProductId?: ProductId; initialBankIds?: readonly BankSlug[]; availableBanks?: readonly Bank[] }) {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const initialBankId = initialProductId ? bankSlugForProduct(initialProductId) : undefined;
  const initialCustomBankIds = initialBankIds ?? (initialBankId ? [initialBankId] : undefined);
  const [builderBankIds, setBuilderBankIds] = useState<BankSlug[]>(() => hasPaidAccess ? [] : [...(initialCustomBankIds ?? [])]);
  const handleBuilderSelectionChange = useCallback((selectedBankIds: readonly BankSlug[]) => {
    setBuilderBankIds([...selectedBankIds]);
  }, []);
  const chooseInterval = (nextInterval: BillingInterval) => {
    setInterval(nextInterval);
    trackProductEvent("billing_interval_change", { interval: nextInterval });
  };
  const totalQuestions = availableBanks.reduce((total, bank) => total + bank.questionCount, 0);
  const totalPapers = availableBanks.reduce((total, bank) => total + bank.paperCount, 0);
  const addOnBanks = availableBanks.filter((bank) => !ownedBankIds.includes(bank.slug) && Boolean(getCatalogBank(bank.slug)?.productId));
  const individualBankSubscriptions = currentPlanProductIds.filter((id) => id.startsWith("bank_")).length;
  const ownsAllAccess = currentPlanProductIds.includes("bundle_all");
  const currentPlanMode = ownsAllAccess ? "all"
    : currentPlanProductIds.some((id) => id === "bundle_custom" || (id.startsWith("bundle_") && id !== "bundle_all")) ? "builder"
      : currentPlanProductIds.some((id) => id.startsWith("bank_")) ? "single" : null;

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
    const newSubscriptionNote = isBuilder && hasPaidAccess && builderQuantity >= 2 && builderQuantity <= 5
      ? interval === "annual" ? `New plan: billed ${formatCents(builderAnnualTotalCents)} once a year.` : `New plan: billed ${headlinePrice} monthly.`
      : null;
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

    const current = hasPaidAccess && currentPlanMode === plan.mode;
    const currentAllAccess = ownsAllAccess || !addOnBanks.length;
    const canAdd = hasPaidAccess && !currentAllAccess;
    const cardBanks = canAdd ? addOnBanks : availableBanks;
    return (
      <article className={`pricing-option${plan.popular ? " pricing-option-popular" : ""}${current ? " pricing-option-current" : ""}`} data-plan-tone={plan.tone} data-current-plan={current ? "true" : undefined} data-mobile-order={plan.popular ? "first" : undefined} key={plan.name}>
        <Image className="plan-art" src={plan.artwork} alt="" width={420} height={260} aria-hidden="true" sizes="(max-width: 1024px) 68vw, 300px" />
        <div className="pricing-option-heading">
          <div className="plan-title-block">
            <span className="plan-icon" aria-hidden="true"><PlanIcon weight="duotone" /></span>
            <div><p className="plan-label">{plan.label}</p><h2>{plan.name}</h2></div>
          </div>
          {current ? <span className="pricing-badge pricing-badge-current">{plan.mode === "single" && individualBankSubscriptions > 1 ? "Your subscriptions" : "Your access"}</span> : plan.popular ? <span className="pricing-badge">Most popular</span> : null}
        </div>
        <div className="plan-price"><strong aria-live={isBuilder ? "polite" : undefined}>{headlinePrice}</strong><span>/ month</span></div>
        <p className="plan-billing-note">{hasPaidAccess ? newSubscriptionNote ?? (canAdd || current ? "Standard price for a new subscription, not your current charge." : "Standard price shown, not your current charge.") : billingNote}</p>
        <p className="plan-description">{plan.description}</p>
        {hasPaidAccess && !canAdd && plan.mode === "all" ? <p className="pricing-plan-access-note">{complimentaryAccess ? "Included with your complimentary access." : "Your existing rate stays unchanged."}</p> : plan.mode === "all" ? (
          <PlanCheckout
            options={[{ productId: "bundle_all", label: "All Access" }]}
            interval={interval}
            authenticated={authenticated}
            hasPaidAccess={hasPaidAccess}
            allowPaidPurchase={canAdd}
            previewOnly={previewOnly}
            ctaLabel={hasPaidAccess ? "Add All Access subscription" : checkoutCta}
          />
        ) : (
          <CustomBundleCheckout
            mode={plan.mode}
            interval={interval}
            authenticated={authenticated}
            hasPaidAccess={hasPaidAccess}
            allowPaidPurchase={canAdd}
            previewOnly={previewOnly}
            initialBankIds={hasPaidAccess ? [] : initialCustomBankIds}
            availableBanks={cardBanks}
            onSelectionChange={isBuilder ? handleBuilderSelectionChange : undefined}
            ctaLabel={hasPaidAccess && isBuilder ? `Add ${builderQuantity} banks` : checkoutCta}
          />
        )}
        {hasPaidAccess && !canAdd && plan.mode !== "all" ? <p className="pricing-plan-access-note">{current ? complimentaryAccess ? "Included with your complimentary access." : plan.mode === "single" && individualBankSubscriptions > 1 ? `${individualBankSubscriptions} separate bank subscriptions. Your existing rates stay unchanged.` : "Your existing rate stays unchanged." : "All available banks are already included."}</p> : null}
        {!hasPaidAccess ? <p className="plan-assurance">Secure Stripe checkout · Cancel any time</p> : null}
      </article>
    );
  };

  return (
    <div className="public-surface">
      <section className="simple-page pricing-page shell">
        {previewOnly ? <p className="pricing-preview-notice" role="status">Local preview: no account or checkout is connected. Choose a view using the links above the pricing page.</p> : null}
        <div className="pricing-intro">
          <p className="eyebrow">PastPaperPrep pricing</p>
          <h1 aria-label="Pay only for what you study.">Pay only for what you study.</h1>
          <p className="page-lede">Choose the question banks you need. Every plan includes the same study tools.</p>
        </div>

        {authenticated ? (
          <section className="pricing-current-plan" aria-labelledby="current-plan-heading">
            <div><span className="eyebrow">Account</span><h2 id="current-plan-heading">Your current access</h2></div>
            <div className="pricing-current-plan-details">
              <strong>{hasPaidAccess ? currentPlanNames.join(", ") || "Paid access" : "Free"}</strong>
              <span>{hasPaidAccess ? complimentaryAccess ? "Complimentary access" : previewOnly ? "Example paid account. No billing is connected in this preview." : "Your access is active. Manage billing to cancel or update payment details." : "Choose a plan below to unlock every available question."}</span>
            </div>
            {hasPaidAccess && !complimentaryAccess && !previewOnly ? <PortalButton /> : null}
          </section>
        ) : null}

        <div className="billing-toggle" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={interval === "monthly"} onClick={() => chooseInterval("monthly")}>Monthly</button>
          <button className="billing-toggle-annual" type="button" aria-pressed={interval === "annual"} onClick={() => chooseInterval("annual")}>Annual — save {maximumAnnualSavingPercent()}%<span className="billing-savings">2 months free</span></button>
        </div>

        {hasPaidAccess && !addOnBanks.length ? <p className="pricing-all-included">All available banks are included in your access.</p> : null}
        <div className="pricing-decision-grid" aria-label="PastPaperPrep plans" data-paid={hasPaidAccess ? "true" : undefined}>
          {PLANS.map(renderPlan)}
        </div>

        <div className="pricing-product-proof" aria-label="Current PastPaperPrep coverage">
          <span><strong>{totalQuestions.toLocaleString()}</strong> questions</span>
          <span><strong>{totalPapers.toLocaleString()}</strong> papers</span>
          <span><strong>{availableBanks.length}</strong> available banks</span>
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

        <p className="checkout-note">Secure Stripe checkout. Cancel any time. Existing subscribers remain grandfathered at their current price and access. <Link href="/refund-policy">Read the refund policy.</Link></p>
      </section>
    </div>
  );
}
