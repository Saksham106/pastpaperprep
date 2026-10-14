import repairs from "@/data/reviewed-0580-core-crop-repairs.json";
import type { BankSlug } from "@/lib/banks";

type Repair = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[] };
const entries = repairs.questions as Record<string, Repair>;
const NAMESPACE = /^repairs\/0580-core-crops-v1-[a-f0-9]{16}$/;
const DIGEST = /^[a-f0-9]{64}$/;

/**
 * Reviewed crop-boundary repairs of live 0580 Core 2021-2025 question crops (trailing blank pages,
 * answer lines cut by the footer margin, a split answer line, a clipped axis label). Each repaired
 * image has a new immutable content-addressed key; the sealed raw bank and its storage receipts stay
 * historical. A row whose live paths differ from the reviewed old paths fails closed.
 */
export function reviewed0580CoreQuestionPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  if (bank !== "igcse") return [...paths];
  const entry = Object.prototype.hasOwnProperty.call(entries, questionId) ? entries[questionId] : undefined;
  if (!entry) return [...paths];
  if (JSON.stringify(paths) !== JSON.stringify(entry.oldPaths) || !NAMESPACE.test(repairs.namespace) ||
      entry.oldSha256.length !== entry.oldPaths.length || entry.newPaths.length !== entry.oldPaths.length ||
      entry.newPaths.length !== entry.sha256.length || new Set(entry.newPaths).size !== entry.newPaths.length ||
      entry.newPaths.some((path, index) => !DIGEST.test(entry.sha256[index]) || !DIGEST.test(entry.oldSha256[index]) ||
        entry.sha256[index] === entry.oldSha256[index] || path !== `${repairs.namespace}/${entry.sha256[index]}.webp`)) {
    throw new Error(`Reviewed 0580 Core crop repair disagrees with ${bank}:${questionId}`);
  }
  return [...entry.newPaths];
}
