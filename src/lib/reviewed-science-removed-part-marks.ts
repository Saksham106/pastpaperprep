import repairs from "@/data/reviewed-science-removed-part-marks.json";
import type { BankSlug } from "@/lib/banks";

export type RemovedPartEntry = {
  old: number | null;
  printedTotal: number;
  assessableMarks: number;
  removedParts: { part: string; marks: number }[];
};
const banks = repairs.entries as Partial<Record<string, Record<string, RemovedPartEntry>>>;

/** The reviewed entry for a question whose part the exam board removed, if any. */
export function removedPartEntry(bank: string, questionId: string): RemovedPartEntry | undefined {
  const entries = banks[bank];
  return entries && Object.prototype.hasOwnProperty.call(entries, questionId) ? entries[questionId] : undefined;
}

/** Fails closed unless the printed total minus the removed parts is exactly the assessable marks. */
export function assertRemovedPartEntry(bank: string, questionId: string, entry: RemovedPartEntry): void {
  const removed = entry.removedParts.reduce((sum, part) => sum + part.marks, 0);
  if (!entry.removedParts.length || !entry.removedParts.every((part) => Number.isInteger(part.marks) && part.marks > 0) ||
    !Number.isInteger(entry.assessableMarks) || entry.assessableMarks <= 0 || entry.printedTotal - removed !== entry.assessableMarks ||
    (entry.old !== null && entry.old !== entry.printedTotal)) {
    throw new Error(`Reviewed removed-part marks are inconsistent for ${bank}:${questionId}`);
  }
}

/**
 * Marks for questions whose part the exam board removed (docs/igcse-science-removed-part-marks.md). Owner decision
 * 2026-11-19: serve the marks students can score, from the official mark scheme; the printed total stays in the
 * entry as provenance. The sealed runtime row stays unchanged; stale input fails closed.
 */
export function removedPartMarks(bank: BankSlug, questionId: string, marks: number | null): number | null {
  const entry = removedPartEntry(bank, questionId);
  if (!entry) return marks;
  assertRemovedPartEntry(bank, questionId, entry);
  if (marks !== entry.old) throw new Error(`Reviewed removed-part marks disagree with ${bank}:${questionId}`);
  return entry.assessableMarks;
}

/**
 * The free whole-paper archive lists printed question maxima. A question with a removed part is listed with its
 * assessable marks, and the paper maximum drops by the removed marks, so a self-marked paper totals what can be scored.
 */
export function assessableArchiveQuestion<Q extends { id: string; maxMarks: number }>(bank: string, question: Q): { question: Q; removed: number } {
  const entry = removedPartEntry(bank, question.id);
  if (!entry) return { question, removed: 0 };
  assertRemovedPartEntry(bank, question.id, entry);
  if (question.maxMarks !== entry.printedTotal) throw new Error(`Archive maximum disagrees with the printed total for ${bank}:${question.id}`);
  return { question: { ...question, maxMarks: entry.assessableMarks }, removed: entry.printedTotal - entry.assessableMarks };
}
