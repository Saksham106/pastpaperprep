import { createHash } from 'node:crypto';
import { fileAliases, paperSlug, subjectSlugForBank } from './past-paper-catalog';
import type { WholePaperSummary } from './whole-paper-types';

/** Free past-paper PDFs live in the public `pastpaperprep-free` R2 bucket, so opening one never runs a Vercel function. */
export const FREE_PAPER_ORIGIN = 'https://free.pastpaperprep.com';
const PREFIX = 'papers/v1/';
const SHA256 = /^[a-f0-9]{64}$/;

export function paperObjectKey(sha256: string): string {
  if (!SHA256.test(sha256)) throw new Error('Invalid paper hash');
  return `${PREFIX}${sha256}.pdf`;
}
export const paperObjectUrl = (sha256: string) => `${FREE_PAPER_ORIGIN}/${paperObjectKey(sha256)}`;

/** Cross-origin links ignore `download=`, so each object carries this name in its Content-Disposition. */
export function paperDownloadName(p: WholePaperSummary, kind: 'question' | 'markscheme'): string {
  return `${fileAliases(p)?.[kind] ?? `${subjectSlugForBank(p.bankSlug)}-${paperSlug(p)}_${kind === 'question' ? 'qp' : 'ms'}`}.pdf`;
}

/** One line per distinct PDF, sorted, so any added, removed or resized document changes the digest. */
export function paperObjectsDigest(objects: ReadonlyMap<string, number>): string {
  return createHash('sha256').update([...objects].sort(([a], [b]) => a.localeCompare(b)).map(([sha, bytes]) => `${sha} ${bytes}\n`).join('')).digest('hex');
}

/** Written by scripts/publish-free-papers.mts only after every object downloaded from the public origin matched. */
export type PublicReadback = { version: 2; status: 'verified_public_readback'; origin: typeof FREE_PAPER_ORIGIN; prefix: typeof PREFIX; verifiedAt: string; objectCount: number; objectsSha256: string };
export function validPublicReadback(v: unknown): v is PublicReadback {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  const keys = ['version', 'status', 'origin', 'prefix', 'verifiedAt', 'objectCount', 'objectsSha256'];
  return Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k))
    && r.version === 2 && r.status === 'verified_public_readback' && r.origin === FREE_PAPER_ORIGIN && r.prefix === PREFIX
    && typeof r.verifiedAt === 'string' && Number.isFinite(Date.parse(r.verifiedAt))
    && Number.isSafeInteger(r.objectCount) && (r.objectCount as number) > 0
    && typeof r.objectsSha256 === 'string' && SHA256.test(r.objectsSha256);
}
