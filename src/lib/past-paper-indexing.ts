/**
 * Which /past-papers pages ask search engines to index them. One rule, used by page metadata and the
 * sitemap, so the two never disagree.
 *
 * Why (docs/audits/2026-11-07-past-paper-indexing/README.md): ~3,000 near-identical pages wrapping
 * official PDFs made up 88% of the sitemap when Google demoted the site on 2026-10-26. A paper page is
 * indexed only when it carries content of its own:
 * - worked answers: a free-year paper whose explanations are printed in the page, or
 * - the latest exam year of its subject, where search demand is (61% of paper-page clicks before the drop).
 * Every other paper page and every year list (it only re-lists papers the subject and paper-number
 * pages already list) stays live and linked, with noindex, follow.
 * Subject and paper-number pages are always indexed: they are the collection pages students search for.
 *
 * Boards in LATEST_YEAR_HELD_BACK get no latest-year exemption: their paper pages need worked answers.
 * Cambridge A Level launched 2026-11-18 without the search history behind the latest-year rule, and its
 * latest-year pages are ~250–520 words of shared template, so adding ~90 of them would repeat the thin
 * pattern behind the demotion (docs/audits/2026-11-20-a-level-indexing/README.md). Lift it once GSC shows
 * A Level paper-page demand or the pages carry worked answers.
 */
export const WORKED_ANSWER_COVERAGE = 0.8;
export const LATEST_YEAR_HELD_BACK: ReadonlySet<string> = new Set(['a-level']);

export type PaperIndexing = { indexed: boolean; reason: 'worked-answers' | 'latest-year' | null };

/** `questionCount` is the whole paper's count from the archive, never the length of a partial bank import;
 * null when the archive doesn't know it, and then worked answers alone never qualify a page. */
export function paperIndexing({ year, latestYear, questionCount, workedAnswers, qualification }: { year: number; latestYear: number; questionCount: number | null; workedAnswers: number; qualification?: string }): PaperIndexing {
  if (questionCount !== null && questionCount > 0 && workedAnswers / questionCount >= WORKED_ANSWER_COVERAGE) return { indexed: true, reason: 'worked-answers' };
  if (year === latestYear && !(qualification && LATEST_YEAR_HELD_BACK.has(qualification))) return { indexed: true, reason: 'latest-year' };
  return { indexed: false, reason: null };
}
