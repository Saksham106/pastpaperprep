import Link from "next/link";
import { ANNUAL_SALE, ANNUAL_SALE_MAX_PERCENT } from "@/lib/annual-sale";

/** Static markup; CSS shows it only once the head script marks <html data-annual-sale="live">. */
export function AnnualSaleBanner() {
  return <aside className="annual-sale-banner" aria-label={`${ANNUAL_SALE.name} offer`}>
    <span><strong>{ANNUAL_SALE.name}:</strong> up to {ANNUAL_SALE_MAX_PERCENT}% off your first year on annual plans. Ends {ANNUAL_SALE.endLabel}.</span>
    <Link prefetch={false} href="/pricing?interval=annual">See annual plans <span aria-hidden="true">→</span></Link>
  </aside>;
}
