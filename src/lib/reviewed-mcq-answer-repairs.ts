import repairs from '@/data/reviewed-mcq-answer-repairs.json';
import scienceRepairs from '@/data/reviewed-science-mcq-answer-repairs.json';
import writtenRepairs from '@/data/reviewed-biology-written-answer-repairs.json';
import mathsRepairs from '@/data/reviewed-maths-source-answer-repairs.json';
import scienceWrittenRepairs from '@/data/reviewed-science-written-answer-repairs.json';
import scienceMsRowRepairs from '@/data/reviewed-science-ms-row-repairs.json';
import scienceCropRepairs0620And0625 from '@/data/reviewed-science-crop-repairs-0620-0625.json';
import scienceMsContinuationRepairs from '@/data/reviewed-science-ms-continuation-repairs.json';
import economicsWrittenRepairs from '@/data/reviewed-economics-written-answer-repairs.json';
import economicsMsRowRepairs from '@/data/reviewed-economics-ms-row-repairs.json';
import ibMatrixRepairs from '@/data/reviewed-ib-matrix-head-repairs.json';
import ibBoundaryRepairs from '@/data/reviewed-ib-boundary-batch-repairs.json';
import ibScienceCropRepairs from '@/data/reviewed-ib-science-crop-repairs.json';
import type { BankSlug } from '@/lib/banks';
import { historicalMarkschemePaths } from '@/lib/reviewed-biology-historical-crops';

type Repair = { oldPaths: string[]; newPaths: string[]; sha256: string };
const entries = repairs.entries as Record<string, Repair>;
// Imported only through server runtime normalization; client references to questions.ts are type-only.
const scienceEntries = scienceRepairs as Partial<Record<BankSlug, Record<string, Repair>>>;
const writtenEntries = writtenRepairs as Record<string, { oldPaths: string[]; newPaths: string[]; sha256: string[] }>;

type IbCropRepair = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[] };
const ibScienceCropBanks = ibScienceCropRepairs.banks as Partial<Record<BankSlug, Record<string, IbCropRepair>>>;
/** IB science banks with reviewed answer-crop repairs; runtime normalization applies them for these banks. */
export const IB_SCIENCE_CROP_REPAIR_BANKS: ReadonlySet<BankSlug> = new Set(Object.keys(ibScienceCropBanks) as BankSlug[]);

/** Exact reviewed replacements; original sealed runtime and storage receipts remain historical. */
export function reviewedMarkschemePaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  if (IB_SCIENCE_CROP_REPAIR_BANKS.has(bank)) {
    const entry = ibScienceCropBanks[bank]?.[questionId];
    if (!entry) return [...paths];
    // Bound to the exact old paths; a kept path keeps its old hash, a new one lives under the namespace by hash.
    if (JSON.stringify(paths)!==JSON.stringify(entry.oldPaths) || entry.oldPaths.length!==entry.oldSha256.length ||
        entry.newPaths.length<1 || entry.newPaths.length!==entry.sha256.length || new Set(entry.newPaths).size!==entry.newPaths.length ||
        !/^repairs\/ib-science-crop-v1-[a-f0-9]{16}$/.test(ibScienceCropRepairs.namespace) ||
        entry.newPaths.some((path,i)=>{
          const oldIndex=entry.oldPaths.indexOf(path);
          return !/^[a-f0-9]{64}$/.test(entry.sha256[i]) || (oldIndex>=0
            ? entry.sha256[i]!==entry.oldSha256[oldIndex]
            : path!==`${ibScienceCropRepairs.namespace}/${entry.sha256[i]}.webp`);
        })) throw new Error(`Reviewed IB science crop repair disagrees with ${bank}:${questionId}`);
    return [...entry.newPaths];
  }
  if (bank === 'ib-hl') {
    const entry = (ibBoundaryRepairs.banks['ib-hl'] as Record<string,{oldPaths:string[];oldSha256:string[];newPaths:string[];sha256:string[]}>)[questionId];
    if (!entry) return [...paths];
    if (JSON.stringify(paths)!==JSON.stringify(entry.oldPaths) || entry.oldPaths.length!==entry.oldSha256.length ||
        entry.newPaths.length<1 || entry.newPaths.length!==entry.sha256.length || new Set(entry.newPaths).size!==entry.newPaths.length ||
        !/^repairs\/ib-boundary-batch-v1-[a-f0-9]{16}$/.test(ibBoundaryRepairs.namespace) ||
        entry.newPaths.some((path,i)=>{
          const oldIndex=entry.oldPaths.indexOf(path);
          return !/^[a-f0-9]{64}$/.test(entry.sha256[i]) || (oldIndex>=0
            ? entry.sha256[i]!==entry.oldSha256[oldIndex]
            : path!==`${ibBoundaryRepairs.namespace}/${entry.sha256[i]}.webp`);
        })) throw new Error(`Reviewed IB boundary repair disagrees with ${bank}:${questionId}`);
    return [...entry.newPaths];
  }
  if (bank === 'ib-ai-hl') {
    const entry = (ibMatrixRepairs.entries as Record<string,{oldPaths:string[];oldSha256:string[];newPaths:string[];sha256:string[]}>)[questionId];
    if (!entry) return [...paths];
    if (JSON.stringify(paths)!==JSON.stringify(entry.oldPaths) || entry.oldSha256.length!==entry.oldPaths.length ||
        entry.newPaths.length<1 || entry.newPaths.length!==entry.sha256.length || new Set(entry.newPaths).size!==entry.newPaths.length ||
        !/^repairs\/ib-matrix-head-v1-[a-f0-9]{16}$/.test(ibMatrixRepairs.namespace) ||
        entry.newPaths.some((path,i)=>{
          const oldIndex=entry.oldPaths.indexOf(path);
          return !/^[a-f0-9]{64}$/.test(entry.sha256[i]) || (oldIndex>=0
            ? entry.sha256[i]!==entry.oldSha256[oldIndex]
            : path!==`${ibMatrixRepairs.namespace}/${entry.sha256[i]}.webp`);
        })) throw new Error(`Reviewed IB matrix repair disagrees with ${bank}:${questionId}`);
    return [...entry.newPaths];
  }
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
    // Economics mark-scheme rows served to the wrong question (docs/economics-ms-row-repairs.md). Checked first: they
    // replace the 2026-10-02 written-answer crop, and are bound to the raw runtime paths.
    const economicsRows = bank === economicsMsRowRepairs.bank && Object.prototype.hasOwnProperty.call(economicsMsRowRepairs.entries, questionId)
      ? (economicsMsRowRepairs.entries as Record<string, IbCropRepair>)[questionId] : undefined;
    if (economicsRows) {
      // A kept path keeps its old hash; a new one lives under the namespace by hash.
      if (JSON.stringify(paths)!==JSON.stringify(economicsRows.oldPaths) || economicsRows.oldPaths.length!==economicsRows.oldSha256.length ||
          economicsRows.newPaths.length<1 || economicsRows.newPaths.length!==economicsRows.sha256.length || new Set(economicsRows.newPaths).size!==economicsRows.newPaths.length ||
          !/^repairs\/economics-ms-rows-v1-[a-f0-9]{16}$/.test(economicsMsRowRepairs.namespace) ||
          economicsRows.newPaths.some((path,i)=>{
            const oldIndex=economicsRows.oldPaths.indexOf(path);
            return !/^[a-f0-9]{64}$/.test(economicsRows.sha256[i]) || (oldIndex>=0
              ? economicsRows.sha256[i]!==economicsRows.oldSha256[oldIndex]
              : path!==`${economicsMsRowRepairs.namespace}/${economicsRows.sha256[i]}.webp`);
          })) throw new Error(`Reviewed economics mark-scheme row repair disagrees with ${bank}:${questionId}`);
      return [...economicsRows.newPaths];
    }
    const scienceWrittenEntries = (bank === 'igcse-economics-0455' ? economicsWrittenRepairs : scienceWrittenRepairs) as Partial<Record<BankSlug, Record<string,{oldPaths:string[];newPaths:string[];sha256:string[]}>>>;
    const writtenNamespace = bank === 'igcse-economics-0455' ? /^repairs\/economics-written-v1-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/ : /^repairs\/science-written-v1-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/;
    // Written answers whose crop misses one of the question's own mark-scheme table rows or shows another question's
    // (docs/science-ms-row-repairs.md, docs/science-crop-repairs-0620-0625.md, docs/science-ms-continuation-repairs.md). Checked first: they replace whatever
    // earlier overlay served, and are bound to the raw runtime paths.
    for (const [overlay, namespace] of [[scienceMsRowRepairs, /^repairs\/science-ms-rows-v1-[a-f0-9]{16}$/], [scienceCropRepairs0620And0625, /^repairs\/science-ms-rows-v2-[a-f0-9]{16}$/], [scienceMsContinuationRepairs, /^repairs\/science-ms-continuation-v1-[a-f0-9]{16}$/]] as const) {
      const msRows = (overlay.banks as Partial<Record<BankSlug, Record<string,{oldPaths:string[];newPaths:string[];sha256:string[]}>>>)[bank]?.[questionId];
      if (!msRows) continue;
      if (!namespace.test(overlay.namespace) || JSON.stringify(paths)!==JSON.stringify(msRows.oldPaths) || msRows.newPaths.length<1 ||
          msRows.newPaths.length!==msRows.sha256.length || new Set(msRows.newPaths).size!==msRows.newPaths.length ||
          msRows.newPaths.some((path,i)=>!/^[a-f0-9]{64}$/.test(msRows.sha256[i]) || path!==`${overlay.namespace}/${msRows.sha256[i]}.webp`)) {
        throw new Error(`Reviewed science mark-scheme row repair disagrees with ${bank}:${questionId}`);
      }
      return [...msRows.newPaths];
    }
    const writtenScience = scienceWrittenEntries[bank]?.[questionId];
    if (writtenScience) {
      if (JSON.stringify(paths)!==JSON.stringify(writtenScience.oldPaths) || writtenScience.newPaths.length<1 ||
          writtenScience.newPaths.length!==writtenScience.sha256.length || new Set(writtenScience.newPaths).size!==writtenScience.newPaths.length ||
          writtenScience.newPaths.some((path,i)=>!writtenNamespace.test(path) ||
            !/^[a-f0-9]{64}$/.test(writtenScience.sha256[i]) || !path.endsWith(`/${writtenScience.sha256[i]}.webp`))) {
        throw new Error(`Reviewed science written answer disagrees with ${bank}:${questionId}`);
      }
      return [...writtenScience.newPaths];
    }
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
  const historical = historicalMarkschemePaths(bank, questionId, paths);
  const written = writtenEntries[questionId];
  if (historical && (written || entries[questionId])) throw new Error(`Two reviewed answer repairs for ${bank}:${questionId}`);
  if (historical) return historical;
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
