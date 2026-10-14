import repairs from '@/data/reviewed-economics-question-crop-repairs.json';
import type { BankSlug } from '@/lib/banks';

type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[]; sourcePdfSha256: string };
const entries = repairs.entries as Record<string, Entry>;
const NAMESPACE = /^repairs\/economics-q1-source-v1-[a-f0-9]{16}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/**
 * Reviewed re-renders of 0455 Paper 2 Q1 anchor-page crops that dropped the source material printed
 * above the Q1 anchor (docs/economics-q1-source-crop-repairs.md). The live path list must match
 * exactly; only the one repaired crop changes, to an immutable SHA-named key. The sealed runtime and
 * its storage receipt stay historical.
 */
export function reviewedEconomicsQuestionPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  if (bank !== repairs.bank) return [...paths];
  const entry = Object.prototype.hasOwnProperty.call(entries, questionId) ? entries[questionId] : undefined;
  if (!entry) return [...paths];
  const changed = entry.newPaths.map((path, i) => path !== entry.oldPaths[i]);
  if (!NAMESPACE.test(repairs.namespace) || JSON.stringify(paths) !== JSON.stringify(entry.oldPaths) ||
      entry.oldSha256.length !== entry.oldPaths.length || entry.newPaths.length !== entry.oldPaths.length ||
      entry.sha256.length !== entry.newPaths.length || changed.filter(Boolean).length !== 1 ||
      !SHA256.test(entry.sourcePdfSha256) ||
      entry.newPaths.some((path, i) => !SHA256.test(entry.sha256[i]) || !SHA256.test(entry.oldSha256[i]) || (changed[i]
        ? path !== `${repairs.namespace}/${entry.sha256[i]}.webp` || entry.sha256[i] === entry.oldSha256[i]
        : entry.sha256[i] !== entry.oldSha256[i]))) {
    throw new Error(`Reviewed economics question crop disagrees with ${bank}:${questionId}`);
  }
  return [...entry.newPaths];
}
