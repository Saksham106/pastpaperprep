import repairs from "@/data/reviewed-0606-ms-right-edge-repairs.json";
import type { BankSlug } from "@/lib/banks";

export type Reviewed0606PrintGeometry = {
  physicalSizePt: [number, number];
  imageDimensions: [number, number];
  segments: [number, number, number, number][];
};
type Entry = {
  oldPaths: string[];
  oldSha256: string[];
  newPaths: string[];
  sha256: string[];
  printGeometry?: Reviewed0606PrintGeometry;
};

const entries = repairs.entries as unknown as Record<string, Entry>;
const NAMESPACE = /^repairs\/0606-ms-right-edge-v1-[a-f0-9]{16}$/;
const HASH = /^[a-f0-9]{64}$/;

/** Every image keeps its position; a replaced image moves to its content-addressed key in this namespace only. */
function assertEntry(questionId: string, entry: Entry): void {
  const count = entry.oldPaths.length;
  let replaced = 0;
  const valid = NAMESPACE.test(repairs.namespace) && count >= 1 &&
    entry.oldSha256.length === count && entry.newPaths.length === count && entry.sha256.length === count &&
    new Set(entry.newPaths).size === count &&
    entry.newPaths.every((path, index) => {
      if (!HASH.test(entry.sha256[index]) || !HASH.test(entry.oldSha256[index])) return false;
      if (path === entry.oldPaths[index]) return entry.sha256[index] === entry.oldSha256[index];
      replaced += 1;
      return path === `${repairs.namespace}/${entry.sha256[index]}.webp` && entry.sha256[index] !== entry.oldSha256[index];
    });
  if (!valid || !replaced) throw new Error(`Reviewed 0606 mark-scheme edge repair is malformed for ${questionId}`);
}

/**
 * Reviewed 0606 mark-scheme crops whose printed table ran past the crop window. Applied after the
 * earlier reviewed repairs: each entry is bound to the exact active paths it replaces and fails closed
 * on anything else. Historical crops, raw runtime JSON and stored objects are untouched.
 */
export function reviewed0606RightEdgePaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  if (bank !== "igcse-additional") return [...paths];
  const entry = entries[questionId];
  if (!entry) return [...paths];
  assertEntry(questionId, entry);
  if (JSON.stringify(paths) !== JSON.stringify(entry.oldPaths)) {
    throw new Error(`Reviewed 0606 mark-scheme edge repair disagrees with igcse-additional:${questionId}`);
  }
  return [...entry.newPaths];
}

/** Print geometry for a repaired single-image answer: the historical vertical geometry at the new width. */
export function reviewed0606RightEdgeGeometry(questionId: string, path: string): Reviewed0606PrintGeometry | null {
  const entry = entries[questionId];
  if (!entry?.printGeometry || entry.newPaths.length !== 1) return null;
  const expected = entry.newPaths[0];
  return path === expected || path.endsWith(`/${expected}`) ? entry.printGeometry : null;
}
