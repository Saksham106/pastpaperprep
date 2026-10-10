"use client";

import Link from "next/link";
import { CheckoutButton } from "@/components/BillingActions";
import type { Bank } from "@/lib/banks";
import type { ProductId } from "@/lib/access";
import { trackProductEvent } from "@/lib/product-analytics";
import { formatPrice, PRICING_MODEL, priceForBankCount } from "@/lib/pricing-model";
import { bankYearFacts, type UpgradePlacement } from "@/lib/upgrade-copy";
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
  /** The upgrade prompt that sent them, carried on to the next pricing view and checkout return. */
  source?: UpgradePlacement;
};

const level = (bank: Bank) => (/-hl$/.test(bank.slug) ? "HL" : /-sl$/.test(bank.slug) ? "SL" : "");
const baseSubject = (bank: Bank) => bank.subject.replace(/ (HL|SL)$/, "");
const isIbMaths = (bank: Bank) => bank.qualification === "International Baccalaureate" && bank.subject.startsWith("Mathematics");

/**
 * One suggestion per other subject in the same qualification, preferring the visitor's own
 * level. Never another level of their subject, and never the other IB maths course.
 */
export function secondSubjectOptions(focus: Bank, banks: readonly Bank[]): Bank[] {
  const bySubject = new Map<string, Bank>();
  for (const bank of banks) {
    if (bank.slug === focus.slug || bank.qualification !== focus.qualification || baseSubject(bank) === baseSubject(focus)) continue;
    if (isIbMaths(focus) && isIbMaths(bank)) continue;
    const current = bySubject.get(baseSubject(bank));
    if (!current || (level(bank) === level(focus) && level(current) !== level(focus))) bySubject.set(baseSubject(bank), bank);
  }
  return [...bySubject.values()];
}

/**
 * Leads the pricing page with the bank a visitor came from (an upgrade prompt), while the
 * full plan grid stays underneath. Checkout uses the same single-bank product and button.
 */
export function PricingBankFocus({ bank, productId, interval, authenticated, previewOnly, otherBanks, allBankCount, source }: Props) {
  const facts = bankYearFacts(bank.slug);
  const label = `Unlock ${bank.shortName}`;
  const price = interval === "annual" ? formatPrice(PRICING_MODEL.oneBank.annualCents / 12) : formatPrice(PRICING_MODEL.oneBank.monthlyCents);
  const billing = interval === "annual" ? `Billed ${formatPrice(PRICING_MODEL.oneBank.annualCents)} once a year` : "Billed monthly";
  const perMonth = (cents: number) => formatPrice(interval === "annual" ? cents / 12 : cents);
  const pricingReturn = `/pricing?interval=${interval}&product=${productId}${source ? `&from=${source}` : ""}`;
  const headingId = `pricing-focus-${bank.slug}`;
  const addSubjectHref = (other: Bank) => {
    const params = new URLSearchParams({ banks: `${bank.slug},${other.slug}` });
    if (interval === "annual") params.set("interval", "annual");
    if (source) params.set("from", source);
    return `/pricing?${params.toString()}`;
  };

  return (
    <section className="pricing-bank-focus" aria-labelledby={headingId}>
      <p className="eyebrow">{bank.qualification} · {bank.shortName}</p>
      <h2 id={headingId}>Unlock every {bank.shortName} paper</h2>
      <p className="pricing-bank-focus-lead">{facts ? `A plan opens ${facts.paidLabel}, including ${facts.latestYear}’s papers.` : "A plan opens every year of this bank."}</p>
      <div className="pricing-bank-focus-card">
        <div>
          <div className="plan-price"><strong>{price}</strong><span>/ month</span></div>
          {interval === "annual" ? <p className="plan-billing-note">{billing}</p> : null}
          {facts ? <ol className="upgrade-years" aria-label="Exam years">
            {facts.coverage.map((year) => { const free = facts.freeYears.includes(year); return <li key={year} className={free ? "is-free" : "is-paid"}>{year}<span className="sr-only"> {free ? "free" : "on a plan"}</span></li>; })}
          </ol> : null}
        </div>
        <div className="pricing-bank-focus-action">
          {previewOnly
            ? <><button className="button primary" type="button" disabled>{label}</button><p className="custom-bundle-selection-note">Preview only — checkout is disabled.</p></>
            : authenticated
              ? <CheckoutButton interval={interval} productId={productId} label={label} />
              : <Link className="button primary" href={`/login?next=${encodeURIComponent(pricingReturn)}`} onClick={() => trackProductEvent("checkout_auth_required", { interval, productId })}>{label}</Link>}
          <p className="plan-assurance">Secure checkout · Cancel any time</p>
        </div>
        {otherBanks.length ? <div className="pricing-bank-focus-more">
          <p><strong>Taking another subject too?</strong> <span>Add one for just {perMonth(priceForBankCount(interval, 2) - priceForBankCount(interval, 1))}/month.</span></p>
          <div className="pricing-bank-focus-chips">
            {otherBanks.slice(0, 4).map((other) => <Link key={other.slug} className="button secondary" href={addSubjectHref(other)}>+ {other.shortName}</Link>)}
            <a className="button secondary pricing-bank-focus-all" href="#plan-all">All {allBankCount} banks · {perMonth(interval === "annual" ? PRICING_MODEL.allAccess.annualCents : PRICING_MODEL.allAccess.monthlyCents)}/mo</a>
          </div>
        </div> : null}
      </div>
    </section>
  );
}
