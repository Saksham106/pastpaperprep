import type { BankSlug } from "@/lib/catalog";
import reviewed from "@/data/reviewed-ib-chemistry-extension-secondaries.json";

/**
 * Verified secondary subtopics for the IB Chemistry 2016-2019 rows, whose generator served the primary subtopic
 * only (scripts/build-ib-chemistry-extension-secondaries.mjs, docs/ib-chemistry-extension-secondaries.md). Applied
 * at load time so the sealed runtime bytes stay unchanged. Each entry is bound to the row's primary subtopic;
 * a row that no longer matches fails closed.
 */
type Entry = { primarySubtopic: string; secondarySubtopics: string[]; secondaryTopics: string[] };
const BANKS = reviewed.banks as Record<string, Record<string, Entry>>;

export function ibChemistryExtensionSecondaries(slug: BankSlug, id: string, rawSubtopics: readonly string[], rawSecondaryTopics: readonly string[]): { subtopics: string[]; secondaryTopics: string[] } | null {
  const entry = BANKS[slug]?.[id];
  if (!entry) return null;
  if (rawSubtopics.length !== 1 || rawSubtopics[0] !== entry.primarySubtopic || rawSecondaryTopics.length) {
    throw new Error(`Reviewed IB Chemistry secondaries no longer match ${slug}/${id}`);
  }
  return { subtopics: [entry.primarySubtopic, ...entry.secondarySubtopics], secondaryTopics: entry.secondaryTopics };
}
