import { Check } from "@phosphor-icons/react/dist/ssr";
import { CheckoutButtons } from "@/components/BillingActions";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <section className="simple-page shell">
      <p className="eyebrow">Introductory all-access</p>
      <h1>All three question banks. One simple plan.</h1>
      <p className="page-lede">PastPaperPrep is new, so the first students get our lowest price while we keep building.</p>
      <article className="founding-plan">
        <div className="founding-plan-copy">
          <span>All-Access</span>
          <h2>Everything you need to practise by topic</h2>
          <p>Full access to IGCSE Mathematics 0580 and IB Mathematics AA at HL and SL.</p>
          <ul>
            <li><Check /> 4,103 official past-paper questions</li>
            <li><Check /> Topic, subtopic, and exam filters</li>
            <li><Check /> Answers and mark schemes where available</li>
            <li><Check /> PDF worksheet export</li>
          </ul>
        </div>
        <div className="founding-prices" aria-label="All-Access subscription prices">
          <div className="price-row"><strong>$4.99</strong><span>per month</span></div>
          <div className="price-row annual-price"><strong>$39.99</strong><span>per year</span><small>Save four months</small></div>
          <CheckoutButtons />
          <p>Secure checkout by Stripe. Supported countries see a local currency at checkout. Cancel any time.</p>
        </div>
      </article>
      <div className="launch-note"><strong>Low pricing for our first students.</strong><p>This introductory price may change as PastPaperPrep adds subjects, progress tools, and new study features.</p></div>
    </section>
  );
}
