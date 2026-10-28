import repairs from '@/data/reviewed-ib-shared-stimulus-repairs.json';
import repairsV2 from '@/data/reviewed-ib-shared-stimulus-repairs-v2.json';
import type { BankSlug } from '@/lib/banks';

type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[] };
type Overlay = { namespace: string; banks: Partial<Record<BankSlug, Record<string, Entry>>> };
const v1 = repairs as Overlay;
const v2 = repairsV2 as Overlay & { reuses: string };
const NAMESPACE = /^repairs\/ib-shared-stimulus-v1-[a-f0-9]{16}$/;
const NAMESPACE_V2 = /^repairs\/ib-shared-stimulus-v2-[a-f0-9]{16}$/;
const SHA256 = /^[a-f0-9]{64}$/;
// The v2 overlay may reuse a v1 stimulus object, which is already stored under the v1 namespace.
const v1Hashes = new Set(Object.values(v1.banks).flatMap((entries) => Object.values(entries ?? {}).flatMap((e) => e.sha256)));

/** IB banks with reviewed shared-stimulus question-crop repairs; runtime normalization applies them for these banks. */
export const IB_SHARED_STIMULUS_BANKS: ReadonlySet<BankSlug> = new Set([...Object.keys(v1.banks), ...Object.keys(v2.banks)] as BankSlug[]);

function own(overlay: Overlay, bank: BankSlug, questionId: string): Entry | undefined {
  const entries = overlay.banks[bank];
  return entries && Object.prototype.hasOwnProperty.call(entries, questionId) ? entries[questionId] : undefined;
}

/**
 * Reviewed IB question crops (docs/ib-shared-stimulus-repairs.md, docs/ib-crop-repairs-v2.md): a stimulus printed above
 * the questions it serves is prepended to each of them, and leaves the question before it. Bound to the exact raw path
 * list; a kept path keeps its served hash, a new crop lives under its overlay's namespace by hash. Stale paths fail closed.
 */
export function reviewedIbQuestionPaths(bank: BankSlug, questionId: string, paths: readonly string[]): string[] {
  const first = own(v1, bank, questionId);
  const second = own(v2, bank, questionId);
  if (first && second) throw new Error(`Two reviewed IB shared-stimulus crops for ${bank}:${questionId}`);
  const entry = first ?? second;
  if (!entry) return [...paths];
  const namespace = first ? v1.namespace : v2.namespace;
  const kept = (path: string, i: number) => {
    const at = entry.oldPaths.indexOf(path);
    return at >= 0 && entry.oldSha256[at] === entry.sha256[i];
  };
  const reused = (path: string, i: number) => Boolean(second) && v2.reuses === v1.namespace && v1Hashes.has(entry.sha256[i]) &&
    path === `${v1.namespace}/${entry.sha256[i]}.webp`;
  if (!NAMESPACE.test(v1.namespace) || !NAMESPACE_V2.test(v2.namespace) || JSON.stringify(paths) !== JSON.stringify(entry.oldPaths) ||
      entry.oldSha256.length !== entry.oldPaths.length || entry.sha256.length !== entry.newPaths.length || entry.newPaths.length < 1 ||
      new Set(entry.newPaths).size !== entry.newPaths.length || ![...entry.oldSha256, ...entry.sha256].every((hash) => SHA256.test(hash)) ||
      entry.newPaths.some((path, i) => !kept(path, i) && !reused(path, i) && path !== `${namespace}/${entry.sha256[i]}.webp`)) {
    throw new Error(`Reviewed IB shared-stimulus crop disagrees with ${bank}:${questionId}`);
  }
  return [...entry.newPaths];
}
