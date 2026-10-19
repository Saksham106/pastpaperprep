import repairs from "@/data/reviewed-science-removed-part-marks.json";
import type { BankSlug } from "@/lib/banks";

type Entry = { old: number | null; new: number; removedPart: string; assessableMarks: number };
const banks = repairs.entries as Partial<Record<BankSlug, Record<string, Entry>>>;

/**
 * Reviewed printed totals for questions whose part the exam board removed while the paper kept its printed
 * [Total] (docs/igcse-science-removed-part-marks.md). The sealed runtime row stays unchanged; stale input fails closed.
 */
export function removedPartMarks(bank: BankSlug, questionId: string, marks: number | null): number | null {
  const entries = banks[bank];
  if (!entries || !Object.prototype.hasOwnProperty.call(entries, questionId)) return marks;
  const entry = entries[questionId];
  if (marks !== entry.old || !Number.isInteger(entry.new) || entry.new <= entry.assessableMarks) {
    throw new Error(`Reviewed removed-part marks disagree with ${bank}:${questionId}`);
  }
  return entry.new;
}
