import repairs from '@/data/reviewed-science-crop-repairs-0620-0625.json';
import type { BankSlug } from '@/lib/banks';

type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[]; sourcePdfSha256: string };
const banks = repairs.questionRepairs as Partial<Record<BankSlug, Record<string, Entry>>>;
const NAMESPACE = /^repairs\/science-ms-rows-v2-[a-f0-9]{16}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/**
 * Reviewed question-paper crop re-renders for the 0620/0625 crop repairs (docs/science-crop-repairs-0620-0625.md):
 * a crop extended to a mark printed against the page footer. The raw path list must match exactly; only the
 * repaired crop changes, to an immutable SHA-named key.
 */
export function reviewedScienceQuestionPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  const entries = banks[bank];
  const entry = entries && Object.prototype.hasOwnProperty.call(entries, questionId) ? entries[questionId] : undefined;
  if (!entry) return [...paths];
  const changed = entry.newPaths.map((path, i) => path !== entry.oldPaths[i]);
  if (!NAMESPACE.test(repairs.namespace) || JSON.stringify(paths) !== JSON.stringify(entry.oldPaths) ||
      entry.oldSha256.length !== entry.oldPaths.length || entry.newPaths.length !== entry.oldPaths.length ||
      entry.sha256.length !== entry.newPaths.length || changed.filter(Boolean).length !== 1 || !SHA256.test(entry.sourcePdfSha256) ||
      entry.newPaths.some((path, i) => !SHA256.test(entry.sha256[i]) || !SHA256.test(entry.oldSha256[i]) || (changed[i]
        ? path !== `${repairs.namespace}/${entry.sha256[i]}.webp` || entry.sha256[i] === entry.oldSha256[i]
        : entry.sha256[i] !== entry.oldSha256[i]))) {
    throw new Error(`Reviewed science question crop disagrees with ${bank}:${questionId}`);
  }
  return [...entry.newPaths];
}
