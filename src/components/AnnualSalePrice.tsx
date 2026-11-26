import { annualSaleCents, formatSaleCents } from "@/lib/annual-sale";
import { formatPrice } from "@/lib/pricing-model";

/** Real annual charge struck through, the first-year sale charge, then what it renews at. */
export function AnnualSalePrice({ annualCents, percentOff }: { annualCents: number | null; percentOff: number }) {
  if (annualCents === null) return <p className="plan-billing-note plan-sale-note">{percentOff}% off your first year</p>;
  return <p className="plan-billing-note plan-sale-note">
    <s aria-label={`was ${formatPrice(annualCents)}`}>{formatPrice(annualCents)}</s> <strong>{formatSaleCents(annualSaleCents(annualCents, percentOff))}</strong> for your first year ({percentOff}% off), then {formatPrice(annualCents)}/yr
  </p>;
}
