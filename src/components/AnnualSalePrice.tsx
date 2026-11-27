import { annualSaleCents, formatSaleCents } from "@/lib/annual-sale";
import { formatPrice } from "@/lib/pricing-model";

/** First-year sale price for an annual charge: per-month headline, yearly charge and renewal. */
export function annualSaleQuote(annualCents: number, percentOff: number) {
  const firstYearCents = annualSaleCents(annualCents, percentOff);
  return {
    wasPerMonth: formatSaleCents(Math.round(annualCents / 12)),
    perMonth: formatSaleCents(Math.round(firstYearCents / 12)),
    firstYear: formatSaleCents(firstYearCents),
    renews: formatPrice(annualCents),
  };
}

/** Struck standard per-month price, the sale per-month price and the discount tag. */
export function AnnualSaleHeadline({ annualCents, percentOff, live, tagPercent }: { annualCents: number; percentOff: number; live?: boolean; tagPercent?: string }) {
  const quote = annualSaleQuote(annualCents, percentOff);
  return <>
    <p className="plan-sale-tag">−{tagPercent ?? percentOff}% first year</p>
    <div className="plan-price plan-price-sale">
      <s className="plan-price-was" aria-label={`was ${quote.wasPerMonth}`}>{quote.wasPerMonth}</s>
      <strong aria-live={live ? "polite" : undefined}>{quote.perMonth}</strong><span>/ month</span>
    </div>
  </>;
}

/** Under the headline: what is charged now and what it renews at. */
export function AnnualSalePrice({ annualCents, percentOff, percentLabel, from }: { annualCents: number | null; percentOff: number; percentLabel?: string; from?: boolean }) {
  if (annualCents === null) return <p className="plan-billing-note plan-sale-note"><strong>{percentLabel ?? `${percentOff}%`} off</strong> your first year</p>;
  const quote = annualSaleQuote(annualCents, percentOff);
  return <p className="plan-billing-note plan-sale-note">{from ? "From " : null}<strong>{quote.firstYear}</strong> for your first year <span className="plan-sale-renews">then {quote.renews}/yr</span></p>;
}
