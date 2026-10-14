import repairs from "@/data/reviewed-biology-historical-crop-repairs.json";
import type { BankSlug } from "@/lib/banks";

/**
 * Reviewed crop repairs for the finalized historical Biology 0610 rows (2019-2025 and
 * February/March 2026). Mark-scheme crops hold only their own question's rows, and question crops
 * no longer stop before a question's last parts and printed [Total]. The finalized runtime and its
 * verified storage receipt stay byte-identical; this projects exact old crop lists onto the
 * repaired lists (kept released keys, or new content-addressed keys under the repair namespace).
 * Source: scripts/build-0610-historical-crop-repairs.mjs, docs/0610-historical-crops-repair.md.
 */
type CropList = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[] };
type Entry = { question?: CropList; markscheme?: CropList; marks?: { old: number; new: number; evidence: string } };

const BANK: BankSlug = "igcse-biology-0610";
const entries = repairs.entries as Record<string, Entry>;

function entryFor(bank: BankSlug, questionId: string): Entry | undefined {
  if (bank !== BANK || !Object.prototype.hasOwnProperty.call(entries, questionId)) return undefined;
  return entries[questionId];
}

function project(role: "question" | "markscheme", questionId: string, paths: readonly string[], list: CropList): string[] {
  const valid = /^repairs\/historical-crops-v1-[a-f0-9]{16}$/.test(repairs.namespace) &&
    JSON.stringify(paths) === JSON.stringify(list.oldPaths) && list.oldSha256.length === list.oldPaths.length &&
    list.newPaths.length > 0 && list.newPaths.length === list.sha256.length && new Set(list.newPaths).size === list.newPaths.length &&
    list.newPaths.every((path, i) => {
      if (!/^[a-f0-9]{64}$/.test(list.sha256[i])) return false;
      const oldIndex = list.oldPaths.indexOf(path);
      return oldIndex >= 0 ? list.sha256[i] === list.oldSha256[oldIndex] : path === `${repairs.namespace}/${list.sha256[i]}.webp`;
    });
  if (!valid) throw new Error(`Reviewed historical ${role} crop repair disagrees with ${BANK}:${questionId}`);
  return [...list.newPaths];
}

/** Active question-paper crops (after the reviewed BLANK PAGE and furniture projections). */
export function historicalQuestionPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  const list = entryFor(bank, questionId)?.question;
  return list ? project("question", questionId, paths, list) : [...paths];
}

/** Mark-scheme crops; never combined with a written-answer repair of the same question. */
export function historicalMarkschemePaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] | null {
  const list = entryFor(bank, questionId)?.markscheme;
  return list ? project("markscheme", questionId, paths, list) : null;
}

/** Printed question total where the repaired crop proves the stored value wrong. */
export function historicalMarks(bank: BankSlug, questionId: string, marks: number | null): number | null {
  const repair = entryFor(bank, questionId)?.marks;
  if (!repair) return marks;
  if (marks !== repair.old || !Number.isInteger(repair.new) || repair.new <= 0) {
    throw new Error(`Reviewed historical marks repair disagrees with ${BANK}:${questionId}`);
  }
  return repair.new;
}
