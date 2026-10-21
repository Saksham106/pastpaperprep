/**
 * Reviewed labels for the IB Chemistry 2016-2019 rows (src/data/reviewed-ib-chemistry-extension-labels.json,
 * docs/ib-chemistry-extension-labels.md): corrected primaries and verified secondary subtopics. Shared by the question
 * loader (src/lib/questions.ts) and the public bank index (scripts/generate-bank-index.mjs) so both serve the same
 * labels. Each entry is bound to the row's sealed primary; a row that no longer matches fails closed.
 *
 * @typedef {{ sourceTopic: string; sourceSubtopic: string; primaryTopic: string; primarySubtopic: string; secondarySubtopics: string[]; secondaryTopics: string[] }} IbChemistryLabels
 */

/**
 * @param {Record<string, Record<string, IbChemistryLabels>>} banks
 * @param {string} slug
 * @param {string} id
 * @param {string} rawPrimaryTopic
 * @param {readonly string[]} rawSubtopics
 * @param {readonly string[]} rawSecondaryTopics
 * @returns {{ primaryTopic: string; subtopics: string[]; secondaryTopics: string[] } | null}
 */
export function applyIbChemistryLabels(banks, slug, id, rawPrimaryTopic, rawSubtopics, rawSecondaryTopics) {
  const entry = banks[slug]?.[id];
  if (!entry) return null;
  if (rawPrimaryTopic !== entry.sourceTopic || rawSubtopics.length !== 1 || rawSubtopics[0] !== entry.sourceSubtopic || rawSecondaryTopics.length) {
    throw new Error(`Reviewed IB Chemistry labels no longer match ${slug}/${id}`);
  }
  return { primaryTopic: entry.primaryTopic, subtopics: [entry.primarySubtopic, ...entry.secondarySubtopics], secondaryTopics: [...entry.secondaryTopics] };
}
