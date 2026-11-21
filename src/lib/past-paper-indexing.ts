/**
 * Which /past-papers pages ask search engines to index them. One rule, used by page metadata and the
 * sitemap, so the two never disagree.
 *
 * Why (docs/audits/2026-11-07-past-paper-indexing, docs/audits/2026-11-20-a-level-indexing): ~3,000
 * near-identical pages wrapping official PDFs made up 88% of the sitemap when Google demoted the site on
 * 2026-10-26. A paper page is indexed only when it carries content of its own:
 * - worked answers: a free-year paper whose explanations are printed in the page, or
 * - demand: a paper on the evidence-based list in src/data/paper-demand.json, which prints a free preview
 *   of 2–3 worked explanations.
 * Every other paper page stays live and linked, with noindex, follow. Students searching for a recent paper
 * code land on the subject's latest-year page instead (2026-11-20 owner decision): it lists every paper of
 * that year with its codes, durations, marks, thresholds and topics. Older year lists stay noindex.
 * Subject and paper-number pages are always indexed: they are the collection pages students search for.
 */
export const WORKED_ANSWER_COVERAGE = 0.8;
/** A demand-listed paper needs at least this many printed preview explanations to be indexed. */
export const MIN_PREVIEW_ANSWERS = 2;

export type PaperIndexing = { indexed: boolean; reason: 'worked-answers' | 'demand' | null };

/** `questionCount` is the whole paper's count from the archive, never the length of a partial bank import;
 * null when the archive doesn't know it, and then worked answers alone never qualify a page. */
export function paperIndexing({ questionCount, workedAnswers, demand = false, previewAnswers = 0 }: { questionCount: number | null; workedAnswers: number; demand?: boolean; previewAnswers?: number }): PaperIndexing {
  if (questionCount !== null && questionCount > 0 && workedAnswers / questionCount >= WORKED_ANSWER_COVERAGE) return { indexed: true, reason: 'worked-answers' };
  if (demand && previewAnswers >= MIN_PREVIEW_ANSWERS) return { indexed: true, reason: 'demand' };
  return { indexed: false, reason: null };
}

/** The year list that stands in for the latest year's paper pages. */
export const yearIndexed = (year: number, latestYear: number) => year === latestYear;
