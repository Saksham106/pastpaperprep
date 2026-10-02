import repairs from '@/data/reviewed-mcq-answer-repairs.json';
import scienceRepairs from '@/data/reviewed-science-mcq-answer-repairs.json';
import type { BankSlug } from '@/lib/banks';

type Repair = { oldPaths: string[]; newPaths: string[]; sha256: string };
const entries = repairs.entries as Record<string, Repair>;
// Imported only through server runtime normalization; client references to questions.ts are type-only.
const scienceEntries = scienceRepairs as Partial<Record<BankSlug, Record<string, Repair>>>;

/** Exact reviewed replacements; original sealed runtime and storage receipts remain historical. */
export function reviewedMarkschemePaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  if (bank !== repairs.bank) {
    const repair = scienceEntries[bank]?.[questionId];
    if (!repair) return [...paths];
    if (JSON.stringify(paths) !== JSON.stringify(repair.oldPaths) || repair.newPaths.length !== 1 ||
        !/^[a-f0-9]{64}$/.test(repair.sha256) ||
        !repair.newPaths[0].endsWith(`/${repair.sha256}.webp`) ||
        !/^repairs\/mcq-answer-v2-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/.test(repair.newPaths[0])) {
      throw new Error(`Reviewed answer repair disagrees with ${bank}:${questionId}`);
    }
    return [...repair.newPaths];
  }
  const repair = entries[questionId];
  if (!repair) return [...paths];
  if (JSON.stringify(paths) !== JSON.stringify(repair.oldPaths) || repair.newPaths.length !== 1 ||
      !/^[a-f0-9]{64}$/.test(repair.sha256) || repair.newPaths.some(path =>
        !/^repairs\/mcq-answer-v1-[a-f0-9]{16}\/[a-z0-9-]+-[a-f0-9]{12}\.webp$/.test(path) ||
        !path.endsWith(`-${repair.sha256.slice(0,12)}.webp`))) {
    throw new Error(`Reviewed answer repair disagrees with ${bank}:${questionId}`);
  }
  return [...repair.newPaths];
}
