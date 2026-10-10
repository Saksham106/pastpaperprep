"use client";

import Link from "next/link";
import { BookOpen, CrownSimple, ShieldCheck, SlidersHorizontal } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CustomBundleCheckout, LifetimeCheckout, PlanCheckout } from "@/components/BillingActions";
import { AccountBillingDetails, CurrentSubscriptionSummary } from "@/components/AccountBillingDetails";
import { AccountSubscriptionEditor } from "@/components/AccountSubscriptionEditor";
import { CourseIcon, courseToneForBank } from "@/components/CourseIcon";
import type { ProductId } from "@/lib/access";
import { bankEntryHref, hasFreeTier } from "@/lib/access";
import { type Bank, type BankSlug } from "@/lib/banks";
import { getGraduatedBundlePrice } from "@/lib/custom-bundles";
import { getCatalogBank, getCatalogBanksForDisplay, getCatalogRuntimeBanks } from "@/lib/catalog";
import { PRICING_MODEL } from "@/lib/pricing-model";
import { trackProductEvent } from "@/lib/product-analytics";
import type { UpgradePlacement } from "@/lib/upgrade-copy";
import { clearCheckoutParam } from "@/components/CheckoutReturnTracker";
import { annualSavingPercent, formatPrice, maximumAnnualSavingPercent, priceForBankCount } from "@/lib/pricing-model";
import { QualificationTabs } from "@/components/QualificationTabs";
import { PricingBankFocus } from "@/components/PricingBankFocus";

function bankSlugForProduct(productId: string): BankSlug | undefined {
  return getCatalogBanksForDisplay().find((bank) => bank.productId === productId)?.slug;
}

const PLANS = [
  {
    name: "One Bank", label: PRICING_MODEL.oneBank.label, monthly: formatPrice(PRICING_MODEL.oneBank.monthlyCents), annualMonthly: formatPrice(PRICING_MODEL.oneBank.annualCents / 12), annual: formatPrice(PRICING_MODEL.oneBank.annualCents), annualSaving: `${annualSavingPercent(PRICING_MODEL.oneBank.monthlyCents, PRICING_MODEL.oneBank.annualCents)}%`,
    description: "Focus on one syllabus.", features: ["Every year, including the newest papers", "Every official mark scheme", "Save and download PDFs", "Mock paper builder"], mode: "single" as const, tone: "starter", popular: false, icon: BookOpen, cta: "Choose One Bank",
  },
  {
    name: "Build Your Plan", label: `${PRICING_MODEL.builder.minBanks} to ${PRICING_MODEL.builder.maxBanks} banks`, monthly: formatPrice(PRICING_MODEL.builder.baseMonthlyCents), annualMonthly: formatPrice(PRICING_MODEL.builder.baseAnnualCents / 12), annual: `${formatPrice(PRICING_MODEL.builder.baseAnnualCents)}+`, annualSaving: `${annualSavingPercent(PRICING_MODEL.builder.baseMonthlyCents, PRICING_MODEL.builder.baseAnnualCents)}%`,
    description: "Mix the banks you actually take.", features: ["Everything in One Bank", "For every subject you take", "One subscription, one bill"], mode: "builder" as const, tone: "builder", popular: true, icon: SlidersHorizontal, cta: "Build Your Plan",
  },
  {
    name: "All Access", label: PRICING_MODEL.allAccess.label, monthly: formatPrice(PRICING_MODEL.allAccess.monthlyCents), annualMonthly: formatPrice(PRICING_MODEL.allAccess.annualCents / 12), annual: formatPrice(PRICING_MODEL.allAccess.annualCents), annualSaving: `${annualSavingPercent(PRICING_MODEL.allAccess.monthlyCents, PRICING_MODEL.allAccess.annualCents)}%`,
    description: "Everything, including future banks.", features: ["Every bank, every subject", "New banks as they launch", "Best for tutors and schools"], mode: "all" as const, tone: "premium", popular: false, icon: CrownSimple, cta: "Unlock all banks",
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

export function PricingContent({ authenticated, hasPaidAccess, currentPlanNames = [], currentPlanProductIds = [], complimentaryAccess = false, manualAccess = false, previewOnly = false, previewStacked = false, addOnIntent = false, ownedBankIds = [], initialInterval = "monthly", initialLifetimeSelected = false, initialProductId, initialBankIds, availableBanks = getCatalogRuntimeBanks(), source, checkoutStatus }: { authenticated: boolean; hasPaidAccess: boolean; currentPlanNames?: string[]; currentPlanProductIds?: readonly ProductId[]; complimentaryAccess?: boolean; manualAccess?: boolean; previewOnly?: boolean; previewStacked?: boolean; addOnIntent?: boolean; ownedBankIds?: readonly BankSlug[]; initialInterval?: BillingInterval; initialLifetimeSelected?: boolean; initialProductId?: ProductId; initialBankIds?: readonly BankSlug[]; availableBanks?: readonly Bank[]; source?: UpgradePlacement; checkoutStatus?: "cancelled" }) {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [lifetimeSelected, setLifetimeSelected] = useState(initialLifetimeSelected ?? false);
  const pricingPageRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const page = pricingPageRef.current;
    const scene = page?.querySelector<HTMLElement>(".lifetime-scenic");
    if (!page || !scene || !lifetimeSelected) {
      page?.style.removeProperty("--lifetime-scene-height");
      return;
    }
    const measure = () => {
      const pageTop = page.getBoundingClientRect().top;
      const sceneBottom = scene.getBoundingClientRect().bottom;
      page.style.setProperty("--lifetime-scene-height", `${Math.max(0, sceneBottom - pageTop)}px`);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(page);
    observer?.observe(scene);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      page.style.removeProperty("--lifetime-scene-height");
    };
  }, [lifetimeSelected]);
  useEffect(() => {
    const artwork = new window.Image();
    artwork.src = "/artwork/lifetime-philosopher-cathedral.webp";
  }, []);
  const initialBankId = initialProductId ? bankSlugForProduct(initialProductId) : undefined;
  const initialCustomBankIds = initialBankIds ?? (initialBankId ? [initialBankId] : undefined);
  const funnelReportedRef = useRef(false);
  useEffect(() => {
    if (funnelReportedRef.current) return;
    funnelReportedRef.current = true;
    trackProductEvent("pricing_view", {
      ...(initialProductId ? { product: initialProductId } : {}),
      ...(source ? { from: source } : {}),
      interval: initialInterval,
      signedIn: authenticated,
      hasPaidAccess,
      bankCount: hasPaidAccess ? 0 : initialCustomBankIds?.length ?? 0,
    });
    if (checkoutStatus === "cancelled") { trackProductEvent("checkout_cancelled", {}); clearCheckoutParam(); }
    // Report the page as it was first opened; later selections are separate events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Subscribers keep the bank they asked for, minus banks they already own.
  const preselectedBankIds = hasPaidAccess ? (initialCustomBankIds ?? []).filter((id) => !ownedBankIds.includes(id)) : initialCustomBankIds;
  const [builderBankIds, setBuilderBankIds] = useState<BankSlug[]>(() => [...(preselectedBankIds ?? [])]);
  const handleBuilderSelectionChange = useCallback((selectedBankIds: readonly BankSlug[]) => {
    setBuilderBankIds([...selectedBankIds]);
  }, []);
  const chooseInterval = (nextInterval: BillingInterval | "lifetime") => {
    setLifetimeSelected(nextInterval === "lifetime");
    if (nextInterval !== "lifetime") setInterval(nextInterval);
    trackProductEvent("billing_interval_change", { interval: nextInterval });
  };
  // Visitors who came from a bank's upgrade prompt see that bank first.
  const focusBank = !hasPaidAccess && initialProductId?.startsWith("bank_") ? availableBanks.find((bank) => bank.slug === bankSlugForProduct(initialProductId)) : undefined;
  const totalQuestions = availableBanks.reduce((total, bank) => total + bank.questionCount, 0);
  const totalPapers = availableBanks.reduce((total, bank) => total + bank.paperCount, 0);
  const addOnBanks = availableBanks.filter((bank) => !ownedBankIds.includes(bank.slug) && Boolean(getCatalogBank(bank.slug)?.productId));
  const individualBankSubscriptions = currentPlanProductIds.filter((id) => id.startsWith("bank_")).length;
  const ownsAllAccess = currentPlanProductIds.includes("bundle_all") || currentPlanProductIds.includes("lifetime_all_access");
  const ownsLifetimeAccess = currentPlanProductIds.includes("lifetime_all_access");
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
      ? interval === "annual" ? "Billed once a year" : "Billed monthly"
      : interval === "annual"
        ? isBuilder
          ? `Billed ${formatCents(builderAnnualTotalCents)} once a year. Save ${getBuilderAnnualSaving(builderQuantity)}`
          : `Billed ${plan.annual} once a year. Save ${plan.annualSaving}`
        : "Billed monthly";

    const current = hasPaidAccess && currentPlanMode === plan.mode;
    const currentAllAccess = ownsAllAccess || !addOnBanks.length;
    const canAdd = hasPaidAccess && !currentAllAccess && !manualAccess;
    const cardBanks = canAdd ? addOnBanks : availableBanks;
    return (
      <article id={plan.mode === "all" && !hasPaidAccess ? "plan-all" : undefined} className={`pricing-option${plan.popular ? " pricing-option-popular" : ""}${current ? " pricing-option-current" : ""}`} data-plan-tone={plan.tone} data-current-plan={current ? "true" : undefined} data-mobile-order={plan.popular ? "first" : undefined} key={plan.name}>
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
        {hasPaidAccess && !canAdd && plan.mode === "all" ? <p className="pricing-plan-access-note">{complimentaryAccess ? "Included with your complimentary access." : manualAccess ? "Shown for comparison. Your grant covers only selected banks." : ownsLifetimeAccess ? "Included with your Lifetime access." : "Your existing rate stays unchanged."}</p> : plan.mode === "all" ? (
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
            initialBankIds={preselectedBankIds}
            availableBanks={cardBanks}
            onSelectionChange={isBuilder ? handleBuilderSelectionChange : undefined}
            ctaLabel={hasPaidAccess && isBuilder ? `Add ${builderQuantity} banks` : checkoutCta}
          />
        )}
        {hasPaidAccess && !canAdd && plan.mode !== "all" ? <p className="pricing-plan-access-note">{current ? complimentaryAccess ? "Included with your complimentary access." : manualAccess ? "Shown for comparison. Your grant covers only selected banks." : ownsLifetimeAccess ? "Included with your Lifetime access." : plan.mode === "single" && individualBankSubscriptions > 1 ? `${individualBankSubscriptions} separate bank subscriptions. Your existing rates stay unchanged.` : "Your existing rate stays unchanged." : manualAccess ? "Shown for comparison. Your grant covers only selected banks." : "All available banks are already included."}</p> : null}
        {!hasPaidAccess ? <p className="plan-assurance">Secure checkout · Cancel any time</p> : null}
        <ul className="plan-feature-list" aria-label={`${plan.name} includes`}>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
      </article>
    );
  };

  const billingToggle = <div className="billing-toggle" role="group" aria-label="Billing period">
    <button type="button" aria-pressed={!lifetimeSelected && interval === "monthly"} onClick={() => chooseInterval("monthly")}>Monthly</button>
    <button className="billing-toggle-annual" type="button" aria-pressed={!lifetimeSelected && interval === "annual"} onClick={() => chooseInterval("annual")}>Annual <span className="billing-savings">Save up to {maximumAnnualSavingPercent()}%</span></button>
    <button className="billing-toggle-lifetime" type="button" aria-pressed={lifetimeSelected} onClick={() => chooseInterval("lifetime")}>Lifetime</button>
  </div>;

  const lifetimeOffer = <section className="lifetime-scenic" data-lifetime="true" aria-label="Lifetime access offer">
    <div className="lifetime-scenic-content">
      <h2>Lifetime full access</h2>
      <div className="lifetime-price"><strong>$299</strong><span> once</span></div>
      <p className="lifetime-scope">All current + future question banks</p>
      <LifetimeCheckout authenticated={authenticated} previewOnly={previewOnly} accessCovered={complimentaryAccess || ownsLifetimeAccess} />
      <ul className="lifetime-benefits" aria-label="Lifetime plan features">
        <li><BookOpen aria-hidden="true" />All subjects</li><li><CrownSimple aria-hidden="true" />Lifetime updates</li><li><SlidersHorizontal aria-hidden="true" />One payment</li><li><ShieldCheck aria-hidden="true" />Secure checkout</li>
      </ul>
    </div>
  </section>;
  const previewSubscription = previewOnly && hasPaidAccess && !complimentaryAccess ? (() => {
    const selectedBanks = availableBanks.filter((bank) => ownedBankIds.includes(bank.slug)).map(({ slug, shortName }) => ({ slug, name: shortName }));
    const bankSelection = ownsAllAccess ? { kind: "all" as const } : { kind: "selected" as const, banks: selectedBanks };
    const currentInterval = initialInterval === "annual" ? "year" : "month";
    const quantity = ownsAllAccess ? availableBanks.length : Math.max(1, selectedBanks.length);
    const monthly = ownsAllAccess ? PRICING_MODEL.allAccess.monthlyCents : priceForBankCount("monthly", quantity);
    const annual = ownsAllAccess ? PRICING_MODEL.allAccess.annualCents : priceForBankCount("annual", quantity);
    return { status: "active", cancelAtPeriodEnd: false, bankSelection, item: { id: "preview-price", quantity: 1, recurringSubtotalCents: initialInterval === "annual" ? annual : monthly, currentPeriodEnd: "2027-06-30T00:00:00.000Z", price: { currency: "usd", interval: currentInterval, intervalCount: 1 } } };
  })() : null;

  return (
    <div className="public-surface">
      <section ref={pricingPageRef} className={`simple-page pricing-page shell${lifetimeSelected ? " pricing-page-lifetime" : ""}`}>
        <header className="pricing-recurring-intro" aria-label="Pricing plans">
          <h1>Practise every past paper, newest first.</h1>
          <p>Start free with older years. A plan unlocks the latest papers and every mark scheme.</p>
        </header>
        <div className="pricing-toggle-sticky">
          {billingToggle}
        </div>
        {lifetimeSelected ? <div className="pricing-toggle-anchor pricing-toggle-anchor-lifetime" data-selected-mode="lifetime">{lifetimeOffer}</div> : null}

        {authenticated && !hasPaidAccess ? <section className="pricing-current-plan" aria-labelledby="current-plan-heading"><div><span className="eyebrow">Account</span><h2 id="current-plan-heading">Your current access</h2></div><div className="pricing-current-plan-details"><strong>Free</strong><span>Choose a plan below to unlock every available question.</span></div></section> : null}
        {hasPaidAccess && !complimentaryAccess && (ownsLifetimeAccess || lifetimeSelected) ? <section className="pricing-current-plan" aria-labelledby="current-plan-heading">
          <div><span className="eyebrow">Account</span><h2 id="current-plan-heading">Your current access</h2></div>
          <div className="pricing-current-plan-details"><strong>{ownsLifetimeAccess ? "Lifetime access" : currentPlanNames.join(", ") || "Paid access"}</strong><span>{ownsLifetimeAccess ? "Lifetime access is active. Any separately billed subscription remains listed under Billing." : previewOnly ? "Example only — price and renewal date are illustrative; no billing account is connected." : "Your account entitlement is verified above. Charges and change options appear below only after billing state is verified; public standard prices may differ from your stored rate."}</span></div>
          {previewOnly ? <span className="pricing-current-plan-note">Manage billing is disabled in this local example.</span> : <Link className="button secondary" href="/account/billing">Manage billing</Link>}
        </section> : null}
        {hasPaidAccess && !complimentaryAccess && !manualAccess && !ownsLifetimeAccess && !lifetimeSelected ? <section id="change-plan" className="pricing-account-plan-editor" aria-label="Change your current subscription">
          {previewStacked && previewSubscription ? <><div className="pricing-preview-notice" role="status">Example only — these separate subscription prices and dates are illustrative. No billing account or change handlers are connected.</div><p className="account-billing-warning">These are separate subscriptions with separate charges and renewal dates. They are not a combined plan.</p>{previewSubscription.bankSelection.kind === "selected" ? previewSubscription.bankSelection.banks.map((bank, index) => <CurrentSubscriptionSummary key={bank.slug} subscription={{ status: "active", cancelAtPeriodEnd: false, bankSelection: { kind: "selected", banks: [bank] } }} item={{ ...previewSubscription.item, id: `preview-price-${index}`, recurringSubtotalCents: priceForBankCount("monthly", 1), currentPeriodEnd: index ? "2027-07-31T00:00:00.000Z" : "2027-06-30T00:00:00.000Z" }} />) : null}</> : previewSubscription ? <><div className="pricing-preview-notice" role="status">Example only — price and renewal date are illustrative. No billing account or change handlers are connected.</div><CurrentSubscriptionSummary subscription={previewSubscription} item={previewSubscription.item} billingManagement="preview" /><AccountSubscriptionEditor subscription={{ id: "preview-subscription", cancelAtPeriodEnd: false, bankSelection: previewSubscription.bankSelection, item: previewSubscription.item }} bankOptions={availableBanks.map(({ slug, shortName }) => ({ slug, name: shortName }))} onUpdated={() => undefined} demo billingInterval={interval} onBillingIntervalChange={setInterval} /></> : <AccountBillingDetails mode="subscription" showBillingManagement billingInterval={interval} onBillingIntervalChange={setInterval} />}
        </section> : null}
        {hasPaidAccess && !complimentaryAccess && addOnIntent && addOnBanks.length > 0 && !lifetimeSelected ? <details className="pricing-additional-offers" open>
          <summary>Requested additional subscription</summary>
          <p>This is separate from your current plan and creates a separate charge and renewal. It does not replace your subscription or apply credit. For an ordinary plan change, use the reviewed editor above.</p>
          <div className="pricing-decision-grid" aria-label="Requested additional subscription" data-paid="true">{PLANS.map(renderPlan)}</div>
        </details> : null}
        {focusBank && initialProductId && !lifetimeSelected ? <PricingBankFocus
          bank={focusBank}
          productId={initialProductId}
          interval={interval}
          authenticated={authenticated}
          previewOnly={previewOnly}
          otherBanks={availableBanks.filter((bank) => bank.qualification === focusBank.qualification && bank.slug !== focusBank.slug)}
          allBankCount={availableBanks.length}
        /> : null}
        {focusBank && !lifetimeSelected ? <h2 className="pricing-compare-heading">Or compare every plan</h2> : null}
        {(!hasPaidAccess || (hasPaidAccess && (complimentaryAccess || manualAccess || ownsLifetimeAccess))) && !lifetimeSelected ? <div className="pricing-decision-grid" aria-label="PastPaperPrep plans">{PLANS.map(renderPlan)}</div> : null}
        {manualAccess && !complimentaryAccess ? <section className="pricing-current-plan" aria-labelledby="current-plan-heading"><div><span className="eyebrow">Account</span><h2 id="current-plan-heading">Your current access</h2></div><div className="pricing-current-plan-details"><strong>Manual access</strong><span>Included banks are covered by an access grant, not a billed plan. Billing details for any separate subscription remain in your account.</span></div><Link className="button secondary" href="/account/subscription">View your access</Link></section> : null}
        {complimentaryAccess ? <section className="pricing-current-plan" aria-labelledby="current-plan-heading"><div><span className="eyebrow">Account</span><h2 id="current-plan-heading">Your current access</h2></div><div className="pricing-current-plan-details"><strong>Complimentary access</strong><span>This is a grant, not a billed subscription. No renewal or plan-change controls are available.</span></div><Link className="button secondary" href="/account/subscription">View your access</Link></section> : null}

        {previewOnly ? <p className="pricing-preview-notice" role="status">Local preview: no account or checkout is connected. Choose a view using the links above the pricing page.</p> : null}

        <div className="pricing-product-proof" aria-label="Current PastPaperPrep coverage">
          <span><strong>{totalQuestions.toLocaleString()}</strong> questions</span>
          <span><strong>{totalPapers.toLocaleString()}</strong> papers</span>
          <span><strong>{availableBanks.length}</strong> available banks</span>
        </div>

        {!hasPaidAccess ? <div className="pricing-free-strip">
          <div><strong>Not ready to pay?</strong><span>Practise complete older exam years for free.</span></div>
          <Link className="button secondary" href={bankEntryHref("igcse")}>Browse free questions</Link>
        </div> : null}

        {!hasPaidAccess ? <section className="pricing-referral-note" aria-labelledby="pricing-referral-heading">
          <div>
            <p className="eyebrow">Share &amp; save</p>
            <h2 id="pricing-referral-heading">Refer friends. Get plan credit.</h2>
            <p>Eligible referrals can earn a month of credit toward a paid plan after review.</p>
          </div>
          <Link className="button secondary" href={authenticated ? "/account/referrals" : "/login?next=/account/referrals"}>See referral rewards <span aria-hidden="true">↗</span></Link>
        </section> : null}

        {!hasPaidAccess ? <section className="pricing-faq" aria-labelledby="pricing-faq-heading">
          <h2 id="pricing-faq-heading">Common questions</h2>
          <dl>
            <div><dt>{"What's free?"}</dt><dd>Older exam years for each bank, with answers. No card needed.</dd></div>
            <div><dt>Can I cancel?</dt><dd>Yes, any time from your account. Access continues through the paid billing period.</dd></div>
            <div><dt>Monthly or annual?</dt><dd>Annual saves up to {maximumAnnualSavingPercent()}%. You can switch later.</dd></div>
            <div><dt>Do I get the newest papers?</dt><dd>{"Yes. Every plan includes the latest sessions as they're added."}</dd></div>
          </dl>
        </section> : null}

        <section className="pricing-bank-catalog" aria-labelledby="pricing-bank-catalog-heading">
          <div className="pricing-bank-catalog-heading">
            <div>
              <p className="eyebrow">What you get</p>
              <h2 id="pricing-bank-catalog-heading">Compare every question bank</h2>
            </div>
            <p>{hasPaidAccess ? "See what is available across the catalogue." : "See the real coverage behind each choice before you pay."}</p>
          </div>
          <QualificationTabs className="pricing-qualification-tabs" items={[
            { id: "pricing-cambridge", label: "Cambridge IGCSE", panel: <BankTable banks={availableBanks.filter((bank) => bank.qualification === "Cambridge IGCSE")} /> },
            { id: "pricing-ib", label: "IB Diploma", panel: <BankTable banks={availableBanks.filter((bank) => bank.qualification === "International Baccalaureate")} /> },
          ].filter((item) => item.panel.props.banks.length > 0)} />
        </section>

        {!hasPaidAccess ? <p className="checkout-note">Secure checkout. Cancel any time. Existing subscribers remain grandfathered at their current price and access. <Link href="/refund-policy">Read the refund policy.</Link></p> : null}
      </section>
    </div>
  );
}
