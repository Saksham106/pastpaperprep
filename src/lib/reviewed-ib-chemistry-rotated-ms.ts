import repairs from '@/data/reviewed-ib-chemistry-rotated-ms-repairs.json';
import type { BankSlug } from '@/lib/banks';

type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[]; pages: number[] };
const banks = repairs.banks as Partial<Record<BankSlug, Record<string, Entry>>>;
const NAMESPACE = /^repairs\/ib-chem-rotated-ms-v1-[a-f0-9]{16}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/**
 * Reviewed IB Chemistry 2017-2019 answer crops (docs/ib-crop-repairs-v2.md): mark schemes stored as rotated landscape
 * pages were cut with their left third missing, and are re-cut in display orientation. Every crop of an affected
 * question is replaced; bound to the exact raw path list, so stale paths fail closed. Returns null for other questions.
 */
export function rotatedChemistryMarkschemePaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] | null {
  const entries = banks[bank];
  const entry = entries && Object.prototype.hasOwnProperty.call(entries, questionId) ? entries[questionId] : undefined;
  if (!entry) return null;
  if (!NAMESPACE.test(repairs.namespace) || JSON.stringify(paths) !== JSON.stringify(entry.oldPaths) ||
      entry.oldSha256.length !== entry.oldPaths.length || entry.newPaths.length < 1 || entry.newPaths.length !== entry.sha256.length ||
      new Set(entry.newPaths).size !== entry.newPaths.length || ![...entry.oldSha256, ...entry.sha256].every((h) => SHA256.test(h)) ||
      entry.newPaths.some((path, i) => path !== `${repairs.namespace}/${entry.sha256[i]}.webp`)) {
    throw new Error(`Reviewed IB Chemistry rotated mark-scheme crop disagrees with ${bank}:${questionId}`);
  }
  return [...entry.newPaths];
}

/** Banks the overlay covers. */
export const IB_CHEMISTRY_ROTATED_MS_BANKS: ReadonlySet<BankSlug> = new Set(Object.keys(banks) as BankSlug[]);
