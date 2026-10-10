import { freeQuestionYears } from "@/lib/access";
import { BANK_CATALOG, type BankSlug } from "@/lib/catalog";
import { formatPrice, PRICING_MODEL } from "@/lib/pricing-model";

export type UpgradePlacement = "top_note" | "feed_teaser" | "feed_timeline" | "locked_card" | "practice_milestone" | "signup_gate" | "pdf_dialog";

export type BankYearFacts = {
  freeLabel: string;
  newerPaidLabel: string;
  latestYear: number;
  coverage: number[];
  freeYears: number[];
  newerPaidYears: number[];
};

export const UPGRADE_PRICE_LABEL = `${formatPrice(PRICING_MODEL.oneBank.monthlyCents)}/mo`;

/** [2016, 2017, 2018] → "2016–2018"; [2016, 2017, 2019] → "2016–2017, 2019". */
export function yearRangeLabel(years: readonly number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let index = 0; index < sorted.length;) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    runs.push(end === index ? String(sorted[index]) : `${sorted[index]}–${sorted[end]}`);
    index = end + 1;
  }
  return runs.join(", ");
}

const catalogEntry = (bankSlug: string) => BANK_CATALOG.find((entry) => entry.slug === bankSlug);

/**
 * Free exam years and the paid years newer than them. The newest years are always paid,
 * which is the message upgrade prompts lead with. Null when a bank has no free tier or
 * nothing paid after its newest free year.
 */
export function bankYearFacts(bankSlug: string): BankYearFacts | null {
  const entry = catalogEntry(bankSlug);
  const match = entry?.years.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  const freeYears = [...(freeQuestionYears(bankSlug as BankSlug) ?? [])];
  if (!entry || !match || !freeYears.length) return null;
  const [start, end] = [Number(match[1]), Number(match[2])];
  const coverage = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const newestFree = Math.max(...freeYears);
  const newerPaidYears = coverage.filter((year) => year > newestFree && !freeYears.includes(year));
  if (!newerPaidYears.length) return null;
  return { freeLabel: yearRangeLabel(freeYears), newerPaidLabel: yearRangeLabel(newerPaidYears), latestYear: end, coverage, freeYears, newerPaidYears };
}

/** Pricing with this bank preselected. Pricing is public and asks for sign-in at checkout. */
export function upgradeHref(bankSlug: string): string {
  const productId = catalogEntry(bankSlug)?.productId;
  return productId ? `/pricing?product=${encodeURIComponent(productId)}` : "/pricing";
}
