import Link from "next/link";
import { ANNUAL_SALE, ANNUAL_SALE_MAX_PERCENT } from "@/lib/annual-sale";
import { SaleCountdown } from "@/components/SaleCountdown";

const TICKER = [
  `${ANNUAL_SALE.name} sale`,
  ...Object.values(ANNUAL_SALE.tiers).map((tier) => `${tier.label} ${tier.percentOff}% off`),
  "Annual plans · first year",
  `Ends ${ANNUAL_SALE.endLabel}`,
];

/** Static markup; CSS shows it only once the head script marks <html data-annual-sale="live">. */
export function AnnualSaleBanner() {
  return <aside className="annual-sale-banner" aria-label={`${ANNUAL_SALE.name} offer`}>
    {/* Option A: headline + live countdown + button. */}
    <div className="annual-sale-banner-inner annual-sale-banner-countdown">
      <p className="annual-sale-banner-copy"><span className="annual-sale-banner-name">{ANNUAL_SALE.name}</span> Up to <strong>{ANNUAL_SALE_MAX_PERCENT}% off</strong> annual plans</p>
      <SaleCountdown endsAt={ANNUAL_SALE.endsAt} />
      <Link prefetch={false} className="annual-sale-banner-cta" href="/pricing?interval=annual">Get the deal <span aria-hidden="true">→</span></Link>
    </div>
    {/* Option B: scrolling ticker of every tier. */}
    <Link prefetch={false} className="annual-sale-banner-inner annual-sale-banner-ticker" href="/pricing?interval=annual" aria-label={`${ANNUAL_SALE.name}: up to ${ANNUAL_SALE_MAX_PERCENT}% off annual plans. See annual plans`}>
      <span className="annual-sale-ticker-track" aria-hidden="true">
        {[0, 1].map((copy) => <span className="annual-sale-ticker-run" key={copy}>
          {TICKER.map((item) => <span key={item}>{item}<i>✦</i></span>)}
        </span>)}
      </span>
    </Link>
  </aside>;
}
