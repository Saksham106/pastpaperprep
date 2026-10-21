import type { BankSlug } from "@/lib/catalog";
import reviewed from "@/data/reviewed-ib-chemistry-extension-labels.json";
import { applyIbChemistryLabels, type IbChemistryLabels } from "@/lib/ib-chemistry-labels.mjs";

/**
 * Reviewed labels for the IB Chemistry 2016-2019 rows: corrected primaries and verified secondary subtopics
 * (scripts/build-ib-chemistry-extension-labels.mjs, docs/ib-chemistry-extension-labels.md). Applied at load time so the
 * sealed runtime bytes stay unchanged. The logic lives in ib-chemistry-labels.mjs, which the public bank index shares.
 */
const BANKS = reviewed.banks as Record<string, Record<string, IbChemistryLabels>>;

export function ibChemistryExtensionLabels(slug: BankSlug, id: string, rawPrimaryTopic: string, rawSubtopics: readonly string[], rawSecondaryTopics: readonly string[]): { primaryTopic: string; subtopics: string[]; secondaryTopics: string[] } | null {
  return applyIbChemistryLabels(BANKS, slug, id, rawPrimaryTopic, rawSubtopics, rawSecondaryTopics);
}
