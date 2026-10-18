import repairs from '@/data/reviewed-ib-shared-stimulus-repairs.json';
import type { BankSlug } from '@/lib/banks';

type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[] };
const banks = repairs.banks as Partial<Record<BankSlug, Record<string, Entry>>>;
const NAMESPACE = /^repairs\/ib-shared-stimulus-v1-[a-f0-9]{16}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/** IB banks with reviewed shared-stimulus question-crop repairs; runtime normalization applies them for these banks. */
export const IB_SHARED_STIMULUS_BANKS: ReadonlySet<BankSlug> = new Set(Object.keys(banks) as BankSlug[]);

/**
 * Reviewed IB question crops (docs/ib-shared-stimulus-repairs.md): a stimulus printed above the questions it serves is
 * prepended to each of them, and leaves the question before it. Bound to the exact raw path list; a kept path keeps its
 * served hash, a new crop lives under the namespace by hash. Stale paths fail closed.
 */
export function reviewedIbQuestionPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  const entries = banks[bank];
  const entry = entries && Object.prototype.hasOwnProperty.call(entries, questionId) ? entries[questionId] : undefined;
  if (!entry) return [...paths];
  const kept = (path: string, i: number) => {
    const at = entry.oldPaths.indexOf(path);
    return at >= 0 && entry.oldSha256[at] === entry.sha256[i];
  };
  if (!NAMESPACE.test(repairs.namespace) || JSON.stringify(paths) !== JSON.stringify(entry.oldPaths) ||
      entry.oldSha256.length !== entry.oldPaths.length || entry.sha256.length !== entry.newPaths.length || entry.newPaths.length < 1 ||
      new Set(entry.newPaths).size !== entry.newPaths.length || ![...entry.oldSha256, ...entry.sha256].every((hash) => SHA256.test(hash)) ||
      entry.newPaths.some((path, i) => !kept(path, i) && path !== `${repairs.namespace}/${entry.sha256[i]}.webp`)) {
    throw new Error(`Reviewed IB shared-stimulus crop disagrees with ${bank}:${questionId}`);
  }
  return [...entry.newPaths];
}
