import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { CheckoutButton } from "@/components/BillingActions";

function PaidPlanAction({
  interval,
  authenticated,
  hasPaidAccess,
}: {
  interval: "monthly" | "annual";
  authenticated: boolean;
  hasPaidAccess: boolean;
}) {
  if (hasPaidAccess) return <Link className="button secondary" href="/account">Manage your access</Link>;
  if (!authenticated) return <Link className={`button ${interval === "annual" ? "primary" : "secondary"}`} href="/login?next=/pricing">Sign in to choose {interval}</Link>;
  return <CheckoutButton interval={interval} />;
}

export function PricingContent({
  authenticated,
  hasPaidAccess,
}: {
  authenticated: boolean;
  hasPaidAccess: boolean;
}) {
  return (
    <section className="simple-page pricing-page shell">
      <p className="eyebrow">Simple access</p>
      <h1>Start free. Upgrade when it is useful.</h1>
      <p className="page-lede">Practise complete older exam years for free. Sign in once, then choose annual or monthly All-Access when you want every question, answer, and PDF worksheet.</p>

      <div className="pricing-options" aria-label="PastPaperPrep plans">
        <article className="pricing-option pricing-option-free">
          <div className="pricing-option-heading">
            <div><p className="plan-label">Explore first</p><h2>Free</h2></div>
            {!hasPaidAccess && <span className="pricing-badge pricing-badge-muted">Current plan</span>}
          </div>
          <div className="plan-price"><strong>$0</strong><span>to start</span></div>
          <p className="plan-description">A meaningful sample, not three teaser questions.</p>
          <ul className="plan-list">
            <li><Check /> IGCSE Mathematics 0580: 2016-2018</li>
            <li><Check /> Additional Mathematics 0606: 2016-2018</li>
            <li><Check /> One complete year from every IB bank</li>
            <li><Check /> Questions and answers online</li>
          </ul>
          {hasPaidAccess ? <p className="plan-status">Paid access is active.</p> : <Link className="button secondary" href="/banks/igcse?free=1">Browse free questions</Link>}
        </article>

        <article className="pricing-option pricing-option-annual">
          <div className="pricing-option-heading">
            <div><p className="plan-label">All-Access</p><h2>Annual</h2></div>
            <span className="pricing-badge">Best value</span>
          </div>
          <div className="annual-comparison"><s>$59.88</s><span>12 monthly payments</span></div>
          <div className="plan-price"><strong>$39.99</strong><span>/ year</span></div>
          <p className="plan-saving">Save $19.89 compared with paying monthly.</p>
          <p className="plan-equivalent">Equivalent to $3.33/month</p>
          <PaidPlanAction interval="annual" authenticated={authenticated} hasPaidAccess={hasPaidAccess} />
        </article>

        <article className="pricing-option pricing-option-monthly">
          <div className="pricing-option-heading">
            <div><p className="plan-label">All-Access</p><h2>Monthly</h2></div>
          </div>
          <div className="plan-price"><strong>$4.99</strong><span>/ month</span></div>
          <p className="plan-description">Full access with a smaller upfront payment.</p>
          <p className="plan-equivalent">$59.88 if kept for 12 months</p>
          <PaidPlanAction interval="monthly" authenticated={authenticated} hasPaidAccess={hasPaidAccess} />
        </article>
      </div>

      <article className="pricing-includes">
        <div>
          <p className="plan-label">Included with All-Access</p>
          <h2>Everything you need to practise by topic</h2>
          <p>Every current question bank, including IGCSE Mathematics, Additional Mathematics, and IB Mathematics at SL and HL.</p>
        </div>
        <ul>
          <li><Check /> Every available past-paper question</li>
          <li><Check /> Topic, subtopic, and exam filters</li>
          <li><Check /> Answers and mark schemes where available</li>
          <li><Check /> PDF worksheet export</li>
        </ul>
      </article>

      <p className="checkout-note">Secure checkout by Stripe. Supported countries see a local currency at checkout. Cancel any time.</p>
      <div className="launch-note"><strong>Low pricing for our first students.</strong><p>This introductory price may change as PastPaperPrep adds subjects, progress tools, and new study features.</p></div>
    </section>
  );
}
