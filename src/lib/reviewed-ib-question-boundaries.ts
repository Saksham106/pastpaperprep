import repairs from '@/data/reviewed-ib-question-boundary-repairs.json';
import type { BankSlug } from '@/lib/banks';

type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[]; marks: { old: number; new: number } };
const banks = repairs.banks as Partial<Record<BankSlug, Record<string, Entry>>>;
const NAMESPACE = /^repairs\/ib-question-boundary-v1-[a-f0-9]{16}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/** IB banks with reviewed question-boundary repairs; runtime normalization applies them for these banks. */
export const IB_QUESTION_BOUNDARY_BANKS: ReadonlySet<BankSlug> = new Set(Object.keys(banks) as BankSlug[]);

function entryFor(bank: BankSlug, questionId: string): Entry | undefined {
  const entries = banks[bank];
  return entries && Object.prototype.hasOwnProperty.call(entries, questionId) ? entries[questionId] : undefined;
}

/**
 * Reviewed IB question crops (docs/ib-question-boundary-repairs.md): Question 1 and Question 2 re-cut at the real
 * Question 2 anchor where an answer-line "2." was taken for it. Bound to the exact raw path list; a kept path keeps its
 * served hash, a new crop lives under the namespace by hash. Stale paths fail closed.
 */
export function reviewedIbBoundaryPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  const entry = entryFor(bank, questionId);
  if (!entry) return [...paths];
  const kept = (path: string, i: number) => {
    const at = entry.oldPaths.indexOf(path);
    return at >= 0 && entry.oldSha256[at] === entry.sha256[i];
  };
  if (!NAMESPACE.test(repairs.namespace) || JSON.stringify(paths) !== JSON.stringify(entry.oldPaths) ||
      entry.oldSha256.length !== entry.oldPaths.length || entry.sha256.length !== entry.newPaths.length || entry.newPaths.length < 1 ||
      new Set(entry.newPaths).size !== entry.newPaths.length || ![...entry.oldSha256, ...entry.sha256].every((hash) => SHA256.test(hash)) ||
      entry.newPaths.some((path, i) => !kept(path, i) && path !== `${repairs.namespace}/${entry.sha256[i]}.webp`)) {
    throw new Error(`Reviewed IB question boundary disagrees with ${bank}:${questionId}`);
  }
  return [...entry.newPaths];
}

/** The printed marks inside the repaired crops; stale runtime marks fail closed. */
export function reviewedIbBoundaryMarks(bank: BankSlug, questionId: string, marks: number | null): number | null {
  const entry = entryFor(bank, questionId);
  if (!entry) return marks;
  if (marks !== entry.marks.old || !Number.isInteger(entry.marks.new) || entry.marks.new <= 0) {
    throw new Error(`Reviewed IB question boundary disagrees with ${bank}:${questionId}`);
  }
  return entry.marks.new;
}
