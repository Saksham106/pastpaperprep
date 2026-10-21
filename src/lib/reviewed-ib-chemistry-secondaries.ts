import type { BankSlug } from "@/lib/catalog";
import reviewed from "@/data/reviewed-ib-chemistry-extension-secondaries.json";
import { applyIbChemistrySecondaries } from "@/lib/ib-chemistry-secondaries.mjs";

/**
 * Verified secondary subtopics for the IB Chemistry 2016-2019 rows, whose generator served the primary subtopic
 * only (scripts/build-ib-chemistry-extension-secondaries.mjs, docs/ib-chemistry-extension-secondaries.md). Applied
 * at load time so the sealed runtime bytes stay unchanged. The logic lives in ib-chemistry-secondaries.mjs, which the
 * public bank index shares.
 */
const BANKS = reviewed.banks as Record<string, Record<string, { primarySubtopic: string; secondarySubtopics: string[]; secondaryTopics: string[] }>>;

export function ibChemistryExtensionSecondaries(slug: BankSlug, id: string, rawSubtopics: readonly string[], rawSecondaryTopics: readonly string[]): { subtopics: string[]; secondaryTopics: string[] } | null {
  return applyIbChemistrySecondaries(BANKS, slug, id, rawSubtopics, rawSecondaryTopics);
}
