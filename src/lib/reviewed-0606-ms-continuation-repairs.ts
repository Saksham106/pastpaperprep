import repairs from "@/data/reviewed-0606-ms-continuation-repairs.json";
import type { BankSlug } from "@/lib/banks";
import type { Reviewed0606PrintGeometry } from "@/lib/reviewed-0606-ms-right-edge-repairs";

type Entry = {
  oldPaths: string[];
  oldSha256: string[];
  newPaths: string[];
  sha256: string[];
  printGeometry: (Reviewed0606PrintGeometry | null)[];
};

const entries = repairs.entries as unknown as Record<string, Entry>;
const NAMESPACE = /^repairs\/0606-ms-continuation-v1-[a-f0-9]{16}$/;
const HASH = /^[a-f0-9]{64}$/;

function entryFor(questionId: string): Entry | undefined {
  return Object.prototype.hasOwnProperty.call(entries, questionId) ? entries[questionId] : undefined;
}

/**
 * Reviewed 0606 mark-scheme rows printed on the next or previous page that the served crop left out
 * (docs/ib-crop-repairs-v2.md). Applied last, after the source-grid and right-edge overlays: each entry is bound to
 * the exact served list, keeps every served crop and its hash, and adds the missing rows as a new crop.
 */
export function reviewed0606ContinuationPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  if (bank !== "igcse-additional") return [...paths];
  const entry = entryFor(questionId);
  if (!entry) return [...paths];
  let added = 0;
  const valid = NAMESPACE.test(repairs.namespace) && JSON.stringify(paths) === JSON.stringify(entry.oldPaths) &&
    entry.oldSha256.length === entry.oldPaths.length && entry.newPaths.length === entry.sha256.length &&
    entry.printGeometry.length === entry.newPaths.length && new Set(entry.newPaths).size === entry.newPaths.length &&
    entry.oldPaths.every((path) => entry.newPaths.includes(path)) &&
    [...entry.oldSha256, ...entry.sha256].every((hash) => HASH.test(hash)) &&
    entry.newPaths.every((path, i) => {
      const kept = entry.oldPaths.indexOf(path);
      if (kept >= 0) return entry.sha256[i] === entry.oldSha256[kept] && entry.printGeometry[i] === null;
      added += 1;
      return path === `${repairs.namespace}/${entry.sha256[i]}.webp` && entry.printGeometry[i] !== null;
    });
  if (!valid || !added) throw new Error(`Reviewed 0606 mark-scheme continuation disagrees with igcse-additional:${questionId}`);
  return [...entry.newPaths];
}

/** Print geometry of an added continuation crop (a single source segment at the bank's 150 dpi grid). */
export function reviewed0606ContinuationGeometry(questionId: string, path: string): Reviewed0606PrintGeometry | null {
  const entry = entryFor(questionId);
  if (!entry) return null;
  const index = entry.newPaths.findIndex((candidate) => path === candidate || path.endsWith(`/${candidate}`));
  return index >= 0 ? entry.printGeometry[index] : null;
}
