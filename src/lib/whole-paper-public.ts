import { createHash } from 'node:crypto';
import { fileAliases, paperSlug, subjectSlugForBank } from './past-paper-catalog';
import type { WholePaperManifest, WholePaperSummary } from './whole-paper-types';

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

export type PaperDocumentRef = { bankSlug: string; paperId: string; kind: 'question' | 'markscheme'; sha256: string; bytes: number };
/** Seals which PDF serves which bank, paper and role, so swapping two documents' hashes closes the gate. */
export function paperMappingDigest(refs: readonly PaperDocumentRef[]): string {
  const lines = refs.map(r => `${r.bankSlug}/${r.paperId}/${r.kind} ${r.sha256} ${r.bytes}\n`).sort();
  return createHash('sha256').update(lines.join('')).digest('hex');
}

/**
 * One object serves every paper that references its bytes, so it carries one filename. Shared IB
 * HL/SL papers drop the level ("ib-economics-hl-…" + "ib-economics-sl-…" -> "ib-economics-…").
 */
export function sharedDownloadName(names: readonly string[]): string {
  const distinct = [...new Set(names)];
  if (distinct.length === 1) return distinct[0];
  const neutral = [...new Set(distinct.map(name => name.replace(/-(?:hl|sl)-/, '-')))];
  if (neutral.length !== 1) throw new Error(`One PDF has unrelated names: ${distinct.join(', ')}`);
  return neutral[0];
}

export type ApprovedPapers = { sizes: Map<string, number>; refs: PaperDocumentRef[]; names: Map<string, string[]> };
/** Every approved PDF (by hash), every bank/paper/role reference to it and its candidate filenames. */
export function approvedPapers(manifests: readonly WholePaperManifest[]): ApprovedPapers {
  const sizes = new Map<string, number>(); const names = new Map<string, string[]>(); const refs: PaperDocumentRef[] = [];
  for (const manifest of manifests) for (const paper of manifest.papers) for (const kind of ['question', 'markscheme'] as const) {
    const doc = paper.documents[kind];
    if (sizes.has(doc.sha256) && sizes.get(doc.sha256) !== doc.bytes) throw new Error(`${doc.sha256} has two sizes`);
    sizes.set(doc.sha256, doc.bytes);
    names.set(doc.sha256, [...(names.get(doc.sha256) ?? []), paperDownloadName(paper.summary, kind)]);
    refs.push({ bankSlug: manifest.bankSlug, paperId: paper.summary.id, kind, sha256: doc.sha256, bytes: doc.bytes });
  }
  return { sizes, refs, names };
}
/** The filename each published object carries (one per object). */
export const objectDownloadNames = (approved: ApprovedPapers) => new Map([...approved.names].map(([sha, names]) => [sha, sharedDownloadName(names)]));

/**
 * An incremental readback fetched only the objects added since `since` (plus a random sample of the
 * rest) and chains from that committed receipt for everything else. `fullReadbackAt` is when the
 * latest full readback in the chain ran.
 */
export type ReadbackChain = {
  since: { verifiedAt: string; objectCount: number; objectsSha256: string; mappingSha256: string };
  fullReadbackAt: string; added: number; sampled: number;
};
/**
 * Written by scripts/publish-free-papers.mts or scripts/publish-added-free-papers.mts only after the
 * objects it read from the public origin matched their approved bytes and filenames: all of them, or,
 * with `incremental`, the added ones plus a sample on top of a receipt that already covered the rest.
 * `mappingSha256` binds each bank/paper/role to its PDF.
 */
export type PublicReadback = { version: 3; status: 'verified_public_readback'; origin: typeof FREE_PAPER_ORIGIN; prefix: typeof PREFIX; verifiedAt: string; objectCount: number; objectsSha256: string; mappingSha256: string; incremental?: ReadbackChain };
const exactKeys = (r: Record<string, unknown>, required: string[], optional: string[] = []) =>
  required.every(k => Object.hasOwn(r, k)) && Object.keys(r).every(k => required.includes(k) || optional.includes(k));
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const count = (v: unknown, min = 0) => Number.isSafeInteger(v) && (v as number) >= min;
const digest = (v: unknown) => typeof v === 'string' && SHA256.test(v);
function validChain(v: unknown): v is ReadbackChain {
  if (!record(v) || !exactKeys(v, ['since', 'fullReadbackAt', 'added', 'sampled'])) return false;
  const s = v.since;
  return record(s) && exactKeys(s, ['verifiedAt', 'objectCount', 'objectsSha256', 'mappingSha256'])
    && date(s.verifiedAt) && count(s.objectCount, 1) && digest(s.objectsSha256) && digest(s.mappingSha256)
    && date(v.fullReadbackAt) && Date.parse(v.fullReadbackAt as string) <= Date.parse(s.verifiedAt as string)
    && count(v.added) && count(v.sampled);
}
export function validPublicReadback(v: unknown): v is PublicReadback {
  if (!record(v)) return false;
  return exactKeys(v, ['version', 'status', 'origin', 'prefix', 'verifiedAt', 'objectCount', 'objectsSha256', 'mappingSha256'], ['incremental'])
    && v.version === 3 && v.status === 'verified_public_readback' && v.origin === FREE_PAPER_ORIGIN && v.prefix === PREFIX
    && date(v.verifiedAt) && count(v.objectCount, 1) && digest(v.objectsSha256) && digest(v.mappingSha256)
    && (v.incremental === undefined || (validChain(v.incremental) && Date.parse(v.incremental.since.verifiedAt) <= Date.parse(v.verifiedAt as string)));
}
