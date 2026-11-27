import Link from "next/link";
import { ANNUAL_SALE, ANNUAL_SALE_MAX_PERCENT } from "@/lib/annual-sale";
import { SaleCountdown } from "@/components/SaleCountdown";

/** Static markup; CSS shows it only once the head script marks <html data-annual-sale="live">. */
export function AnnualSaleBanner() {
  return <aside className="annual-sale-banner" aria-label={`${ANNUAL_SALE.name} offer`}>
    <div className="annual-sale-banner-inner">
      <p className="annual-sale-banner-copy"><span className="annual-sale-banner-name">{ANNUAL_SALE.name}</span> Up to <strong>{ANNUAL_SALE_MAX_PERCENT}% off</strong> annual plans</p>
      <SaleCountdown endsAt={ANNUAL_SALE.endsAt} />
      <Link prefetch={false} className="annual-sale-banner-cta" href="/pricing?interval=annual">Get the deal <span aria-hidden="true">→</span></Link>
    </div>
  </aside>;
}
