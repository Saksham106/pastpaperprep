// Exact membership of the PDFs a whole-paper manifest change newly approves, derived from the manifests
// themselves (base versus head), so a plan file is never trusted for its own approval claim.
import { approvedPapers, objectDownloadNames, paperObjectKey } from "../../src/lib/whole-paper-public";
import type { WholePaperManifest } from "../../src/lib/whole-paper-types";

export type PlannedPdf = { sha256: string; bytes: number; name: string; relativePath: string; key: string };
export type FreePlanInput = { base: string; approvedObjects: number; added: PlannedPdf[] };
type Approved = Map<string, { bytes: number; name: string }>;

export function approvedObjects(manifests: readonly WholePaperManifest[]): Approved {
  const papers = approvedPapers(manifests);
  const names = objectDownloadNames(papers);
  return new Map([...papers.sizes].map(([sha, bytes]) => [sha, { bytes, name: names.get(sha)! }]));
}

/** The PDFs approved by `now` and not by `before`, sorted by hash. */
export function newlyApproved(before: readonly WholePaperManifest[], now: readonly WholePaperManifest[]): { added: Approved; approvedAfter: number } {
  const was = approvedObjects(before);
  const is = approvedObjects(now);
  const renamed = [...is].filter(([sha, object]) => was.has(sha) && was.get(sha)!.name !== object.name);
  if (renamed.length) throw new Error(`Existing objects would change filename: ${renamed.map(([sha]) => sha).join(", ")}`);
  const added = new Map([...is].filter(([sha]) => !was.has(sha)).sort(([a], [b]) => a.localeCompare(b)));
  return { added, approvedAfter: is.size };
}

/**
 * The plan's rows must be exactly the derived membership: the same set of keys, and for each key the same
 * hash, size and download name. A same-count substitution (any key, hash, size or name changed) fails.
 */
export function assertPlanIsApprovedMembership(plan: FreePlanInput, before: readonly WholePaperManifest[], now: readonly WholePaperManifest[]): void {
  const { added, approvedAfter } = newlyApproved(before, now);
  if (plan.approvedObjects !== approvedAfter) throw new Error(`Plan says ${plan.approvedObjects} approved objects; the manifests approve ${approvedAfter}`);
  if (plan.added.length !== added.size) throw new Error(`Plan lists ${plan.added.length} PDFs; the manifests newly approve ${added.size}`);
  const derivedKeys = new Map([...added].map(([sha, object]) => [paperObjectKey(sha), { sha, ...object }]));
  const seen = new Set<string>();
  for (const row of plan.added) {
    if (seen.has(row.key)) throw new Error(`Duplicate plan key ${row.key}`);
    seen.add(row.key);
    const expected = derivedKeys.get(row.key);
    if (!expected) throw new Error(`Plan key is not newly approved: ${row.key}`);
    if (row.sha256 !== expected.sha || row.key !== paperObjectKey(row.sha256)) throw new Error(`Plan hash differs from the approved manifest: ${row.key}`);
    if (row.bytes !== expected.bytes) throw new Error(`Plan size differs from the approved manifest: ${row.key}`);
    if (row.name !== expected.name) throw new Error(`Plan download name differs from the approved manifest: ${row.key}`);
  }
  const missing = [...derivedKeys.keys()].filter((key) => !seen.has(key));
  if (missing.length) throw new Error(`Plan omits newly approved PDFs: ${missing.join(", ")}`);
}
