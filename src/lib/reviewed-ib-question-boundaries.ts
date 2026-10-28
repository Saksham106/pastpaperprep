import repairs from '@/data/reviewed-ib-question-boundary-repairs.json';
import repairsV2 from '@/data/reviewed-ib-question-boundary-repairs-v2.json';
import type { BankSlug } from '@/lib/banks';

type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[]; marks: { old: number; new: number } };
type Overlay = { namespace: string; banks: Partial<Record<BankSlug, Record<string, Entry>>> };
// v1: Biology Q1/Q2 (docs/ib-question-boundary-repairs.md); v2: Physics Paper 1 option-D boundaries (docs/ib-crop-repairs-v2.md).
const OVERLAYS: [Overlay, RegExp][] = [
  [repairs as Overlay, /^repairs\/ib-question-boundary-v1-[a-f0-9]{16}$/],
  [repairsV2 as Overlay, /^repairs\/ib-question-boundary-v2-[a-f0-9]{16}$/],
];
const SHA256 = /^[a-f0-9]{64}$/;

/** IB banks with reviewed question-boundary repairs; runtime normalization applies them for these banks. */
export const IB_QUESTION_BOUNDARY_BANKS: ReadonlySet<BankSlug> = new Set(OVERLAYS.flatMap(([o]) => Object.keys(o.banks)) as BankSlug[]);

function entryWithNamespace(bank: BankSlug, questionId: string): { entry: Entry; namespace: string; pattern: RegExp } | undefined {
  const found = OVERLAYS.flatMap(([overlay, pattern]) => {
    const entries = overlay.banks[bank];
    return entries && Object.prototype.hasOwnProperty.call(entries, questionId) ? [{ entry: entries[questionId], namespace: overlay.namespace, pattern }] : [];
  });
  if (found.length > 1) throw new Error(`Two reviewed IB question boundaries for ${bank}:${questionId}`);
  return found[0];
}
const entryFor = (bank: BankSlug, questionId: string) => entryWithNamespace(bank, questionId)?.entry;

/**
 * Reviewed IB question crops (docs/ib-question-boundary-repairs.md, docs/ib-crop-repairs-v2.md): two neighbouring
 * questions re-cut at the real anchor of the second where another line was taken for it. Bound to the exact raw path list; a kept path keeps its
 * served hash, a new crop lives under the namespace by hash. Stale paths fail closed.
 */
export function reviewedIbBoundaryPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  const found = entryWithNamespace(bank, questionId);
  if (!found) return [...paths];
  const { entry, namespace, pattern } = found;
  const kept = (path: string, i: number) => {
    const at = entry.oldPaths.indexOf(path);
    return at >= 0 && entry.oldSha256[at] === entry.sha256[i];
  };
  if (!pattern.test(namespace) || JSON.stringify(paths) !== JSON.stringify(entry.oldPaths) ||
      entry.oldSha256.length !== entry.oldPaths.length || entry.sha256.length !== entry.newPaths.length || entry.newPaths.length < 1 ||
      new Set(entry.newPaths).size !== entry.newPaths.length || ![...entry.oldSha256, ...entry.sha256].every((hash) => SHA256.test(hash)) ||
      entry.newPaths.some((path, i) => !kept(path, i) && path !== `${namespace}/${entry.sha256[i]}.webp`)) {
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
