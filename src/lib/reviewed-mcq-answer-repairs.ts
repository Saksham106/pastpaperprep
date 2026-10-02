import repairs from '@/data/reviewed-mcq-answer-repairs.json';
import scienceRepairs from '@/data/reviewed-science-mcq-answer-repairs.json';
import writtenRepairs from '@/data/reviewed-biology-written-answer-repairs.json';
import mathsRepairs from '@/data/reviewed-maths-source-answer-repairs.json';
import type { BankSlug } from '@/lib/banks';

type Repair = { oldPaths: string[]; newPaths: string[]; sha256: string };
const entries = repairs.entries as Record<string, Repair>;
// Imported only through server runtime normalization; client references to questions.ts are type-only.
const scienceEntries = scienceRepairs as Partial<Record<BankSlug, Record<string, Repair>>>;
const writtenEntries = writtenRepairs as Record<string, { oldPaths: string[]; newPaths: string[]; sha256: string[] }>;

/** Exact reviewed replacements; original sealed runtime and storage receipts remain historical. */
export function reviewedMarkschemePaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  if (bank === 'igcse' || bank === 'igcse-additional') {
    const mathsEntries = mathsRepairs[bank] as Record<string, {oldPaths:string[]; newPaths:string[]; sha256:string[]}>;
    const maths = mathsEntries[questionId];
    if (!maths) return [...paths];
    if (JSON.stringify(paths) !== JSON.stringify(maths.oldPaths) || maths.newPaths.length < 1 ||
        maths.newPaths.length !== maths.sha256.length || new Set(maths.newPaths).size !== maths.newPaths.length ||
        maths.newPaths.some((path,i) => !/^[a-f0-9]{64}$/.test(maths.sha256[i]) ||
          !/^repairs\/maths-source-grid-v1-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/.test(path) ||
          !path.endsWith(`/${maths.sha256[i]}.webp`))) {
      throw new Error(`Reviewed maths answer repair disagrees with ${bank}:${questionId}`);
    }
    return [...maths.newPaths];
  }
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
  const written = writtenEntries[questionId];
  if (written) {
    if (JSON.stringify(paths) !== JSON.stringify(written.oldPaths) || written.newPaths.length < 1 ||
        written.newPaths.length !== written.sha256.length || new Set(written.newPaths).size !== written.newPaths.length ||
        written.newPaths.some((path, i) => !/^[a-f0-9]{64}$/.test(written.sha256[i]) ||
          !/^repairs\/written-answer-v1-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/.test(path) ||
          !path.endsWith(`/${written.sha256[i]}.webp`))) {
      throw new Error(`Reviewed answer repair disagrees with ${bank}:${questionId}`);
    }
    return [...written.newPaths];
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
