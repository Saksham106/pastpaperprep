/**
 * Incremental public readback for scripts/publish-added-free-papers.mts (`verify --since <base-ref>`).
 * Objects are keyed by SHA-256, so a base receipt that covered exactly the base manifests still covers
 * every object both sides approve, as long as none of them changed its size or download name. Only the
 * added objects need fetching, plus a random sample of the kept ones as a spot check on the bucket.
 */
import { randomInt } from 'node:crypto';
import { FREE_PAPER_ORIGIN, validPublicReadback, type PublicReadback } from '../../src/lib/whole-paper-public';

export type ApprovedObjects = { objects: ReadonlyMap<string, { bytes: number; name: string }>; objectsSha256: string; mappingSha256: string };
export type IncrementalTargets = { added: string[]; sampled: string[]; removed: string[] };
export const DEFAULT_SAMPLE = 64;

/** The base ref's committed receipt, only if it covers exactly the base ref's manifests. */
export function checkedBaseReceipt(value: unknown, base: ApprovedObjects): PublicReadback {
  if (!validPublicReadback(value)) throw new Error('Base receipt is missing or malformed; run a full verify');
  if (value.objectCount !== base.objects.size || value.objectsSha256 !== base.objectsSha256 || value.mappingSha256 !== base.mappingSha256) {
    throw new Error("Base receipt doesn't match the base manifests (objectCount, objectsSha256, mappingSha256); run a full verify");
  }
  return value;
}

/**
 * Objects to fetch: every one approved now but not at base, and up to `sample` kept ones picked at
 * random. Refuses if any object approved on both sides changed its size or download name.
 */
export function incrementalTargets(base: ApprovedObjects, now: ApprovedObjects, sample: number, pick: (max: number) => number = max => randomInt(max)): IncrementalTargets {
  if (!Number.isSafeInteger(sample) || sample < 0) throw new Error(`Invalid sample size ${sample}`);
  const changed = [...base.objects].filter(([sha, o]) => {
    const n = now.objects.get(sha);
    return n && (n.bytes !== o.bytes || n.name !== o.name);
  }).map(([sha]) => sha);
  if (changed.length) throw new Error(`Existing objects changed size or filename (needs a re-put, purge and full verify): ${changed.join(', ')}`);
  const added = [...now.objects.keys()].filter(sha => !base.objects.has(sha)).sort();
  const kept = [...now.objects.keys()].filter(sha => base.objects.has(sha)).sort();
  const removed = [...base.objects.keys()].filter(sha => !now.objects.has(sha)).sort();
  const n = Math.min(sample, kept.length);
  for (let i = 0; i < n; i++) {
    const j = i + pick(kept.length - i);
    [kept[i], kept[j]] = [kept[j], kept[i]];
  }
  return { added, sampled: kept.slice(0, n).sort(), removed };
}

/** The receipt for the current manifests, recording the receipt it chains from. */
export function chainedReceipt(now: ApprovedObjects, base: PublicReadback, targets: IncrementalTargets, verifiedAt: string): PublicReadback {
  return {
    version: 3, status: 'verified_public_readback', origin: FREE_PAPER_ORIGIN, prefix: 'papers/v1/', verifiedAt,
    objectCount: now.objects.size, objectsSha256: now.objectsSha256, mappingSha256: now.mappingSha256,
    incremental: {
      since: { verifiedAt: base.verifiedAt, objectCount: base.objectCount, objectsSha256: base.objectsSha256, mappingSha256: base.mappingSha256 },
      fullReadbackAt: base.incremental?.fullReadbackAt ?? base.verifiedAt,
      added: targets.added.length, sampled: targets.sampled.length,
    },
  };
}
