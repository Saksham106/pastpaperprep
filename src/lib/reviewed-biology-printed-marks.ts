import repairs from "@/data/reviewed-biology-printed-marks.json";
import type { BankSlug } from "@/lib/banks";

/**
 * Reviewed printed question totals for the finalized Biology 0610 runtime, where the printed-marks census
 * proves the stored total wrong and the historical crop overlay does not already correct it. The finalized
 * runtime stays byte-identical. Source: scripts/build-0610-printed-marks.mjs.
 */
type Entry = { old: number; new: number; evidence: string };

const BANK: BankSlug = "igcse-biology-0610";
const entries = repairs.entries as Record<string, Entry>;

export function printedMarks(bank: BankSlug, questionId: string, marks: number | null): number | null {
  if (bank !== BANK || !Object.prototype.hasOwnProperty.call(entries, questionId)) return marks;
  const repair = entries[questionId];
  if (marks !== repair.old || !Number.isInteger(repair.new) || repair.new <= 0) {
    throw new Error(`Reviewed printed marks repair disagrees with ${BANK}:${questionId}`);
  }
  return repair.new;
}
