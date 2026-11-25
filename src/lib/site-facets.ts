import type { SEARCH_INDEX_VERSION } from "@/lib/site-search";

/** Written at build next to the search index (scripts/generate-search-index.mts). Client-safe. */
export const SEARCH_FACETS_PATH = "/search/facets.json";

/** The filter values one bank actually has: newest year first, papers in order, sessions by size. */
export type BankFacets = { years: number[]; papers: number[]; sessions: string[] };
export type SearchFacets = { version: typeof SEARCH_INDEX_VERSION; banks: Record<string, BankFacets> };

export function bankFacets(questions: readonly { year: number; paper: number; session: string }[]): BankFacets {
  const sessions = new Map<string, number>();
  for (const q of questions) if (q.session) sessions.set(q.session, (sessions.get(q.session) ?? 0) + 1);
  return {
    years: [...new Set(questions.map((q) => q.year).filter((year) => Number.isInteger(year) && year > 0))].sort((a, b) => b - a),
    papers: [...new Set(questions.map((q) => q.paper).filter((paper) => Number.isInteger(paper) && paper > 0))].sort((a, b) => a - b),
    sessions: [...sessions].sort((a, b) => b[1] - a[1]).map(([session]) => session),
  };
}

/** Articles and published notes pages (path and title), for the site helper. Written next to facets.json. */
export type SearchPage = { path: string; label: string };
export type SearchPages = { version: typeof SEARCH_INDEX_VERSION; pages: SearchPage[] };
