import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { PlanCheckout } from "@/components/BillingActions";

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

export function PricingContent({ authenticated, hasPaidAccess }: { authenticated: boolean; hasPaidAccess: boolean }) {
  return (
    <section className="simple-page pricing-page shell">
      <p className="eyebrow">Simple access</p>
      <h1>Pay for the maths you actually need.</h1>
      <p className="page-lede">Practise complete older exam years for free. Unlock one bank, bundle a related pair, or get all six.</p>

      <div className="pricing-options" aria-label="PastPaperPrep plans">
        <article className="pricing-option pricing-option-free">
          <div className="pricing-option-heading">
            <div><p className="plan-label">Explore first</p><h2>Free</h2></div>
            {!hasPaidAccess && <span className="pricing-badge pricing-badge-muted">Current plan</span>}
          </div>
          <div className="plan-price"><strong>$0</strong><span>to start</span></div>
          <p className="plan-description">Complete older years from every bank. No tiny teaser sample.</p>
          <ul className="plan-list">
            <li><Check /> IGCSE Mathematics and Additional Mathematics: 2016-2018</li>
            <li><Check /> One complete year from every IB bank</li>
            <li><Check /> Questions and answers online</li>
          </ul>
          {hasPaidAccess ? <p className="plan-status">Paid access is active.</p> : <Link className="button secondary" href="/banks/igcse?free=1">Browse free questions</Link>}
        </article>

        <article className="pricing-option">
          <div className="pricing-option-heading"><div><p className="plan-label">For one student</p><h2>One bank</h2></div></div>
          <div className="plan-price"><strong>$29.99</strong><span>/ year</span></div>
          <p className="plan-saving">$2.99 monthly</p>
          <p className="plan-equivalent">Annual saves $5.89 versus 12 monthly payments.</p>
          <p className="plan-description">Every question, answer, filter, and PDF export for one course.</p>
          <PlanCheckout options={BANK_OPTIONS} authenticated={authenticated} hasPaidAccess={hasPaidAccess} />
        </article>

        <article className="pricing-option pricing-option-annual">
          <div className="pricing-option-heading">
            <div><p className="plan-label">For related courses</p><h2>Subject pair</h2></div>
            <span className="pricing-badge">Most popular</span>
          </div>
          <div className="plan-price"><strong>$49.99</strong><span>/ year</span></div>
          <p className="plan-saving">$4.99 monthly</p>
          <p className="plan-equivalent">Annual saves $9.89 versus 12 monthly payments.</p>
          <p className="plan-description">Save versus two separate banks. Choose IGCSE, IB AA, or IB AI.</p>
          <PlanCheckout options={PAIR_OPTIONS} authenticated={authenticated} hasPaidAccess={hasPaidAccess} />
        </article>

        <article className="pricing-option">
          <div className="pricing-option-heading"><div><p className="plan-label">For tutors and broad coverage</p><h2>All banks</h2></div></div>
          <div className="plan-price"><strong>$89.99</strong><span>/ year</span></div>
          <p className="plan-saving">$8.99 monthly</p>
          <p className="plan-equivalent">Annual saves $17.89 versus 12 monthly payments.</p>
          <p className="plan-description">All six current banks and every bank added while your subscription is active.</p>
          <PlanCheckout options={[{ productId: "bundle_all", label: "All banks" }]} authenticated={authenticated} hasPaidAccess={hasPaidAccess} />
        </article>
      </div>

      <article className="pricing-includes">
        <div>
          <p className="plan-label">Included with every paid plan</p>
          <h2>The complete practice toolkit</h2>
          <p>The same tools at every level. The only difference is how many banks you unlock.</p>
        </div>
        <ul>
          <li><Check /> Every available question in your banks</li>
          <li><Check /> Topic, subtopic, and exam filters</li>
          <li><Check /> Answers and official mark schemes where available</li>
          <li><Check /> PDF worksheet export</li>
        </ul>
      </article>

      <p className="checkout-note">Secure checkout by Stripe. Supported countries see a local currency at checkout. Cancel any time.</p>
      <div className="launch-note"><strong>Existing All-Access subscribers keep their current price.</strong><p>New subscriptions use the bank-based plans above.</p></div>
    </section>
  );
}
