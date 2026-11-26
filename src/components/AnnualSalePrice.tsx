import { annualSaleCents, formatSaleCents } from "@/lib/annual-sale";
import { formatPrice } from "@/lib/pricing-model";

/** Real annual charge struck through, the first-year sale charge, then what it renews at. */
/** `annualCents` null = no selection yet; `percentLabel` then names the range (e.g. "30–35%"). */
export function AnnualSalePrice({ annualCents, percentOff, percentLabel }: { annualCents: number | null; percentOff: number; percentLabel?: string }) {
  if (annualCents === null) return <p className="plan-billing-note plan-sale-note">{percentLabel ?? `${percentOff}%`} off your first year</p>;
  return <p className="plan-billing-note plan-sale-note">
    <s aria-label={`was ${formatPrice(annualCents)}`}>{formatPrice(annualCents)}</s> <strong>{formatSaleCents(annualSaleCents(annualCents, percentOff))}</strong> for your first year ({percentOff}% off), then {formatPrice(annualCents)}/yr
  </p>;
}
