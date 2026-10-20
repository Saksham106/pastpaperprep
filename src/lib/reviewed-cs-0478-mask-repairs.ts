import repairs from '@/data/reviewed-cs-0478-mask-repairs.json';
import type { BankSlug } from '@/lib/banks';

type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[]; falseMaskCount: number };
const questions = repairs.questions as Record<string, Entry>;
const NAMESPACE = /^repairs\/cs-0478-false-masks-v1-[a-f0-9]{16}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/**
 * Reviewed CS 0478 question crops (docs/cs-0478-false-mask-repairs.md): re-renders of crops where the segmenter
 * painted out curly-quoted input data or ellipsis answer leaders as if they were the barcode strip. Bound to the
 * exact raw path list; a kept path keeps its served hash, a repaired crop lives under the namespace by hash.
 * Stale paths fail closed. Other banks' paths are returned unchanged.
 */
export function reviewedCs0478QuestionPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  if (bank !== repairs.bank || !Object.prototype.hasOwnProperty.call(questions, questionId)) return [...paths];
  const entry = questions[questionId];
  const changed = entry.newPaths.map((path, i) => path !== entry.oldPaths[i]);
  if (!NAMESPACE.test(repairs.namespace) || JSON.stringify(paths) !== JSON.stringify(entry.oldPaths) ||
      entry.oldSha256.length !== entry.oldPaths.length || entry.newPaths.length !== entry.oldPaths.length ||
      entry.sha256.length !== entry.newPaths.length || !changed.some(Boolean) || !Number.isInteger(entry.falseMaskCount) || entry.falseMaskCount < 1 ||
      entry.newPaths.some((path, i) => !SHA256.test(entry.sha256[i]) || !SHA256.test(entry.oldSha256[i]) || (changed[i]
        ? path !== `${repairs.namespace}/${entry.sha256[i]}.webp` || entry.sha256[i] === entry.oldSha256[i]
        : entry.sha256[i] !== entry.oldSha256[i]))) {
    throw new Error(`Reviewed CS 0478 mask repair disagrees with ${bank}:${questionId}`);
  }
  return [...entry.newPaths];
}
