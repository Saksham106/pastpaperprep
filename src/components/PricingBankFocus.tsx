"use client";

import Link from "next/link";
import { CheckoutButton } from "@/components/BillingActions";
import type { Bank } from "@/lib/banks";
import type { ProductId } from "@/lib/access";
import { trackProductEvent } from "@/lib/product-analytics";
import { formatPrice, PRICING_MODEL, priceForBankCount } from "@/lib/pricing-model";
import { bankYearFacts } from "@/lib/upgrade-copy";
import "./upgrade-nudges.css";

type Props = {
  bank: Bank;
  productId: ProductId;
  interval: "monthly" | "annual";
  authenticated: boolean;
  previewOnly: boolean;
  /** Other banks in the same qualification, offered as a second subject. */
  otherBanks: readonly Bank[];
  allBankCount: number;
};

/**
 * Leads the pricing page with the bank a visitor came from (an upgrade prompt), while the
 * full plan grid stays underneath. Checkout uses the same single-bank product and button.
 */
export function PricingBankFocus({ bank, productId, interval, authenticated, previewOnly, otherBanks, allBankCount }: Props) {
  const facts = bankYearFacts(bank.slug);
  const label = `Unlock ${bank.shortName}`;
  const price = interval === "annual" ? formatPrice(PRICING_MODEL.oneBank.annualCents / 12) : formatPrice(PRICING_MODEL.oneBank.monthlyCents);
  const billing = interval === "annual" ? `Billed ${formatPrice(PRICING_MODEL.oneBank.annualCents)} once a year` : "Billed monthly · Cancel any time";
  const pricingReturn = `/pricing?interval=${interval}&product=${productId}`;
  const headingId = `pricing-focus-${bank.slug}`;
  const addSubjectHref = (other: Bank) => {
    const params = new URLSearchParams({ banks: `${bank.slug},${other.slug}` });
    if (interval === "annual") params.set("interval", "annual");
    return `/pricing?${params.toString()}`;
  };

  return (
    <section className="pricing-bank-focus" aria-labelledby={headingId}>
      <p className="eyebrow">{bank.qualification} · {bank.shortName}</p>
      <h2 id={headingId}>Unlock every {bank.shortName} paper</h2>
      <p className="pricing-bank-focus-lead">{facts ? `A plan opens ${facts.newerPaidLabel}, including ${facts.latestYear}’s papers.` : "A plan opens every year of this bank."}</p>
      <div className="pricing-bank-focus-card">
        <div>
          <div className="plan-price"><strong>{price}</strong><span>/ month</span></div>
          <p className="plan-billing-note">{billing}</p>
          <ul className="plan-feature-list" aria-label={`${bank.shortName} plan includes`}>
            <li>All {bank.questionCount.toLocaleString()} questions, {bank.years.replace("-", "–")}</li>
            <li>Every official mark scheme</li>
            <li>Save and download PDFs</li>
            <li>Mock paper builder</li>
          </ul>
          {facts ? <ol className="upgrade-years" aria-label="Exam years">
            {facts.coverage.map((year) => { const free = facts.freeYears.includes(year); return <li key={year} className={free ? "is-free" : "is-paid"}>{year}<span className="sr-only"> {free ? "free" : "on a plan"}</span></li>; })}
          </ol> : null}
        </div>
        <div className="pricing-bank-focus-action">
          {previewOnly
            ? <button className="button primary" type="button" disabled>{label}</button>
            : authenticated
              ? <CheckoutButton interval={interval} productId={productId} label={label} />
              : <Link className="button primary" href={`/login?next=${encodeURIComponent(pricingReturn)}`} onClick={() => trackProductEvent("checkout_auth_required", { interval, productId })}>{label}</Link>}
          <p className="plan-assurance">Secure checkout · Cancel any time</p>
        </div>
        {otherBanks.length ? <div className="pricing-bank-focus-more">
          <p><strong>Taking another subject too?</strong> <span>Add it and pay {formatPrice(priceForBankCount("monthly", 2))}/month for both.</span></p>
          <div className="pricing-bank-focus-chips">
            {otherBanks.slice(0, 4).map((other) => <Link key={other.slug} className="button secondary" href={addSubjectHref(other)}>+ {other.shortName}</Link>)}
            <a className="button secondary pricing-bank-focus-all" href="#plan-all">All {allBankCount} banks · {formatPrice(PRICING_MODEL.allAccess.monthlyCents)}/mo</a>
          </div>
        </div> : null}
      </div>
    </section>
  );
}
