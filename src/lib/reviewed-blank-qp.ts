import reviewed from "@/data/reviewed-blank-qp.json";
import type { BankSlug } from "@/lib/banks";

type ApprovedWholeBlank = { path: string; sha256: string; sourcePage: number; sourcePdfSha256: string };
const entries = reviewed.entries as unknown as Partial<Record<BankSlug, Record<string, ApprovedWholeBlank[]>>>;

/** Project only exact, independently reviewed BLANK PAGE images out of active views/exports.
 * Raw release assets and storage receipts remain untouched for audit/recovery.
 */
export function activeQuestionImagePaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  const hidden = entries[bank]?.[questionId];
  if (!hidden) return [...paths];
  const approved = new Set(hidden.map((item) => item.path));
  if (approved.size !== hidden.length || hidden.some((item) => !paths.includes(item.path))) {
    throw new Error("Reviewed blank-page asset projection disagrees with the live question");
  }
  const active = paths.filter((path) => !approved.has(path));
  if (!active.length) throw new Error("Reviewed BLANK PAGE list would erase all question images");
  return active;
}
