/**
 * Papers Cambridge published but candidates never sat (Covid cancellations; the mark scheme cover
 * says so and there are no grade thresholds). Shown next to the series so nobody reads them as a
 * normal sitting. Pure and client-safe.
 */
const NOT_SAT: Readonly<Record<string, readonly { year: number; series: RegExp }[]>> = {
  "a-level-maths-9709": [{ year: 2020, series: /^(may|june|s$)/i }],
};

export function isNotSatSeries(bankSlug: string, year: number, session: string): boolean {
  return Boolean(NOT_SAT[bankSlug]?.some((entry) => entry.year === year && entry.series.test(session.trim())));
}
