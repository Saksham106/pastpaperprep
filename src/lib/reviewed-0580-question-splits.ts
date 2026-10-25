import splits from "@/data/reviewed-0580-question-splits.json";
import type { BankSlug } from "@/lib/banks";

/** [path, imageSha256, widthPx, heightPx, widthPt, heightPt, [sourceY, sourceHeight, physicalHeightPt, sourcePage, include][]] */
export type Split0580Geometry = [string, string, number, number, number, number, [number, number, number, number, 0 | 1][]];
type Entry = {
  oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[];
  marks: { old: number; new: number; printed: number[] };
  accessibleText: { oldSha256: string; text: string };
  printGeometry: Split0580Geometry;
};

const BANK: BankSlug = "igcse";
const entries = splits.entries as unknown as Record<string, Entry>;
const NAMESPACE = /^repairs\/0580-question-split-v1-[a-f0-9]{16}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function entryFor(bank: BankSlug, questionId: string): Entry | undefined {
  if (bank !== BANK || !Object.prototype.hasOwnProperty.call(entries, questionId)) return undefined;
  const entry = entries[questionId];
  if (!NAMESPACE.test(splits.namespace) || entry.newPaths.length !== 1 || entry.sha256.length !== 1 ||
      !SHA256.test(entry.sha256[0]) || entry.newPaths[0] !== `${splits.namespace}/${entry.sha256[0]}.webp` ||
      entry.sha256[0] === entry.oldSha256[0] || entry.printGeometry[0] !== entry.newPaths[0] || entry.printGeometry[1] !== entry.sha256[0] ||
      entry.marks.printed.reduce((sum, mark) => sum + mark, 0) !== entry.marks.new) {
    throw new Error(`Reviewed 0580 question split disagrees with ${bank}:${questionId}`);
  }
  return entry;
}

/**
 * Reviewed 0580 question splits (docs/0580-question-splits.md): a crop cut at a graph-axis label that was taken for the
 * next question's number is replaced by the re-cut crop of its own question, with that question's printed marks and its
 * transcript. Bound to the exact raw paths and marks; stale input fails closed.
 */
export function reviewed0580SplitQuestionPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  const entry = entryFor(bank, questionId);
  if (!entry) return [...paths];
  if (JSON.stringify(paths) !== JSON.stringify(entry.oldPaths)) throw new Error(`Reviewed 0580 question split disagrees with ${bank}:${questionId}`);
  return [...entry.newPaths];
}

export function reviewed0580SplitMarks(bank: BankSlug, questionId: string, marks: number | null): number | null {
  const entry = entryFor(bank, questionId);
  if (!entry) return marks;
  if (marks !== entry.marks.old) throw new Error(`Reviewed 0580 question split disagrees with ${bank}:${questionId}`);
  return entry.marks.new;
}

/** The raw text is checked by hash in tests and the builder; at runtime only the re-cut transcript is served. */
export function reviewed0580SplitText(bank: BankSlug, questionId: string, text: string): string {
  return entryFor(bank, questionId)?.accessibleText.text ?? text;
}

/** Print geometry of a re-cut crop, keyed to its new immutable path only. */
export function reviewed0580SplitGeometry(questionId: string, path: string): Split0580Geometry | null {
  const entry = entryFor(BANK, questionId);
  if (!entry || (path !== entry.newPaths[0] && !path.endsWith(`/${entry.newPaths[0]}`))) return null;
  return entry.printGeometry;
}
