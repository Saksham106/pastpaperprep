/**
 * Verified secondary subtopics for the IB Chemistry 2016-2019 rows (src/data/reviewed-ib-chemistry-extension-secondaries.json,
 * docs/ib-chemistry-extension-secondaries.md). Shared by the question loader (src/lib/questions.ts) and the public
 * bank index (scripts/generate-bank-index.mjs) so both serve the same labels. Each entry is bound to the row's
 * primary subtopic; a row that no longer matches fails closed.
 *
 * @param {Record<string, Record<string, { primarySubtopic: string; secondarySubtopics: string[]; secondaryTopics: string[] }>>} banks
 * @param {string} slug
 * @param {string} id
 * @param {readonly string[]} rawSubtopics
 * @param {readonly string[]} rawSecondaryTopics
 * @returns {{ subtopics: string[]; secondaryTopics: string[] } | null}
 */
export function applyIbChemistrySecondaries(banks, slug, id, rawSubtopics, rawSecondaryTopics) {
  const entry = banks[slug]?.[id];
  if (!entry) return null;
  if (rawSubtopics.length !== 1 || rawSubtopics[0] !== entry.primarySubtopic || rawSecondaryTopics.length) {
    throw new Error(`Reviewed IB Chemistry secondaries no longer match ${slug}/${id}`);
  }
  return { subtopics: [entry.primarySubtopic, ...entry.secondarySubtopics], secondaryTopics: [...entry.secondaryTopics] };
}
