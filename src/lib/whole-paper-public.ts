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
 * Written by scripts/publish-free-papers.mts only after every object downloaded from the public origin
 * matched its approved bytes and filename. `mappingSha256` binds each bank/paper/role to its PDF.
 */
export type PublicReadback = { version: 3; status: 'verified_public_readback'; origin: typeof FREE_PAPER_ORIGIN; prefix: typeof PREFIX; verifiedAt: string; objectCount: number; objectsSha256: string; mappingSha256: string };
export function validPublicReadback(v: unknown): v is PublicReadback {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  const keys = ['version', 'status', 'origin', 'prefix', 'verifiedAt', 'objectCount', 'objectsSha256', 'mappingSha256'];
  return Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k))
    && r.version === 3 && r.status === 'verified_public_readback' && r.origin === FREE_PAPER_ORIGIN && r.prefix === PREFIX
    && typeof r.verifiedAt === 'string' && Number.isFinite(Date.parse(r.verifiedAt))
    && Number.isSafeInteger(r.objectCount) && (r.objectCount as number) > 0
    && typeof r.objectsSha256 === 'string' && SHA256.test(r.objectsSha256)
    && typeof r.mappingSha256 === 'string' && SHA256.test(r.mappingSha256);
}
