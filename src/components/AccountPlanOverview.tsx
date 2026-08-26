import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";

const FREE_FEATURES = ["Complete older exam years", "Saved questions and progress"];
const PAID_FEATURES = ["Every available question", "Answers and mark schemes where available", "Smart filters", "PDF export"];

export function AccountPlanOverview() {
  return (
    <div className="account-plan-overview">
      <div className="account-plan-heading">
        <div>
          <span className="eyebrow">Your access</span>
          <h2>Free plan</h2>
          <p>Keep practising free exam years, or upgrade when you need the full bank.</p>
        </div>
        <Link className="button primary" href="/pricing">Upgrade your plan</Link>
      </div>
      <div className="account-plan-grid">
        <section aria-labelledby="free-includes">
          <h3 id="free-includes">Included now</h3>
          <ul>{FREE_FEATURES.map((feature) => <li key={feature}><Check aria-hidden="true" /> {feature}</li>)}</ul>
        </section>
        <section className="account-paid-preview" aria-labelledby="paid-includes">
          <h3 id="paid-includes">Paid plans unlock</h3>
          <ul>{PAID_FEATURES.map((feature) => <li key={feature}><Check aria-hidden="true" /> {feature}</li>)}</ul>
        </section>
      </div>
    </div>
  );
}
