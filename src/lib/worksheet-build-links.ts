/** The paper builder, optionally with a bank preselected. */
export function buildPaperPath(bank?: string): `/worksheets/build${"" | `?bank=${string}`}` {
  return bank ? `/worksheets/build?bank=${bank}` : "/worksheets/build";
}

/** Sign-in that returns to the builder. Signed-out links use it directly so no navigation lands on the builder's server redirect. */
export function buildPaperLoginPath(bank?: string): string {
  return `/login?next=${encodeURIComponent(buildPaperPath(bank))}`;
}
