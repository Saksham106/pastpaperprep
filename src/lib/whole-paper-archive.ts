import 'server-only';
import { lstatSync, realpathSync, openSync, fstatSync, closeSync, readSync, constants } from 'node:fs';
import { join, resolve, relative, isAbsolute, parse, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { BANK_CATALOG, type BankSlug } from './catalog';
import { paperSlug, subjectSlugForBank } from './past-paper-catalog';
import { paperObjectUrl, paperObjectsDigest, validPublicReadback } from './whole-paper-public';
import type { WholePaperManifest, WholePaperBankSummary, WholePaperSummary, WholePaperDetail } from './whole-paper-types';

export function wholePaperPreviewEnabled() { return process.env.NODE_ENV === 'development' && process.env.LOCAL_PAPER_PREVIEW === 'true'; }
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,159}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const integer = (v: unknown, min = 0, max = 1_000_000): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
const text = (v: unknown, max = 300): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);
function object(v: unknown, required: string[], optional: string[] = []): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
}
function validDocument(v: unknown): boolean {
  return object(v, ['sha256', 'bytes', 'pages']) && typeof v.sha256 === 'string' && SHA256.test(v.sha256) && integer(v.bytes, 5, 100 * 1024 * 1024) && integer(v.pages, 1, 10_000);
}
function validManifest(value: unknown, slug: string): value is WholePaperManifest {
  const bank = BANK_CATALOG.find(b => b.slug === slug);
  if (!bank || !object(value, ['version', 'bankSlug', 'runtimeSha256', 'papers', 'coverage']) || value.bankSlug !== slug || !text(value.version) || typeof value.runtimeSha256 !== 'string' || !SHA256.test(value.runtimeSha256) || !Array.isArray(value.papers) || value.papers.length > 10_000) return false;
  const c = value.coverage;
  if (!object(c, ['paired', 'reports', 'held', 'unpaired', 'runtimeWithoutPair']) || !Object.values(c).every(v => integer(v)) || c.paired !== value.papers.length) return false;
  const ids = new Set<string>();
  let reports = 0;
  for (const p of value.papers) {
    if (!object(p, ['summary', 'version', 'documents', 'questions']) || !text(p.version) || !object(p.documents, ['question', 'markscheme']) || !validDocument(p.documents.question) || !validDocument(p.documents.markscheme) || !Array.isArray(p.questions)) return false;
    const s = p.summary;
    if (!object(s, ['id', 'bankSlug', 'title', 'qualification', 'subject', 'syllabusCode', 'year', 'session', 'sessionCode', 'component', 'paper', 'variant', 'route', 'durationMinutes', 'maxMarks', 'questionCount', 'reportAvailable', 'metadataVerified'], ['reportReason'])) return false;
    if (typeof s.id !== 'string' || !SAFE_ID.test(s.id) || ids.has(s.id) || s.bankSlug !== slug || s.qualification !== bank.qualification || s.subject !== bank.subject || s.syllabusCode !== bank.syllabusCode) return false;
    ids.add(s.id);
    if (!['title', 'session', 'sessionCode', 'component', 'paper'].every(k => text(s[k])) || typeof s.variant !== 'string' || s.variant.length > 20 || !integer(s.year, 1900, 2200) || ![null, 'Core', 'Extended', 'Shared', 'HL', 'SL'].includes(s.route as string | null) || (s.durationMinutes !== null && !integer(s.durationMinutes, 1, 1440)) || (s.maxMarks !== null && !integer(s.maxMarks, 1, 10_000)) || !integer(s.questionCount, 0, 1000) || (s.reportAvailable && s.questionCount !== p.questions.length) || typeof s.reportAvailable !== 'boolean' || typeof s.metadataVerified !== 'boolean' || (s.reportReason !== undefined && !text(s.reportReason, 1000))) return false;
    const qids = new Set<string>(); const numbers = new Set<number>(); let marks = 0;
    for (const q of p.questions) {
      if (!object(q, ['id', 'number', 'maxMarks', 'topics'], ['questionPage']) || !text(q.id) || qids.has(q.id) || !integer(q.number, 1, 1000) || numbers.has(q.number) || !integer(q.maxMarks, 1, 10_000) || !Array.isArray(q.topics) || q.topics.length > 100 || !q.topics.every(t => text(t)) || new Set(q.topics).size !== q.topics.length || (q.questionPage !== undefined && (!integer(q.questionPage, 1) || q.questionPage > (p.documents.question as { pages: number }).pages))) return false;
      qids.add(q.id); numbers.add(q.number); marks += q.maxMarks;
    }
    if (s.reportAvailable) { if (!s.metadataVerified || !p.questions.length || s.maxMarks !== marks || p.questions.some(q=>!q.topics.length)) return false; reports++; }
  }
  return c.reports === reports && c.held === value.papers.length - reports;
}
/** Static generation renders ~2,700 pages from 19 manifests, so each validated manifest is parsed once.
 * The key includes the file's identity and mtime, so a rebuilt or replaced manifest is always re-read. */
const MANIFESTS = new Map<string, { stamp: string; manifest: WholePaperManifest }>();
function readManifest(slug: string): WholePaperManifest | null {
  if (!SAFE_ID.test(slug) || !BANK_CATALOG.some(b => b.slug === slug)) return null;
  try {
    const path = join(process.cwd(), 'src/data/paper-archives', `${slug}.json`);
    const stat = lstatSync(path);
    const stamp = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}`;
    const cached = MANIFESTS.get(path);
    if (cached?.stamp === stamp) return cached.manifest;
    const value: unknown = JSON.parse(checkedRead(path, 16 * 1024 * 1024).toString('utf8'));
    if (!validManifest(value, slug)) return null;
    MANIFESTS.set(path, { stamp, manifest: value });
    return value;
  } catch { return null; }
}
export function getWholePaperSummaries(slug: string): WholePaperSummary[] { return readManifest(slug)?.papers.map(p => p.summary) ?? []; }
export function getWholePaperBanks(): WholePaperBankSummary[] {
  return BANK_CATALOG.map(b => {
    const papers = getWholePaperSummaries(b.slug);
    const years = [...new Set(papers.map(p => p.year))].sort((a,b) => a-b);
    return { bankSlug: b.slug, title: b.title, qualification: b.qualification, subject: b.subject, syllabusCode: b.syllabusCode, level: b.level, paperCount: papers.length, reportCount: papers.filter(p => p.reportAvailable).length, years: years.length ? years.length === 1 ? String(years[0]) : `${years[0]}-${years.at(-1)}` : '', available: papers.length > 0 };
  });
}
export function getWholePaper(slug: string, id: string): WholePaperDetail | null {
  const entry = readManifest(slug)?.papers.find(p => p.summary.id === id);
  if (!entry) return null;
  if (!wholePaperPreviewEnabled()) return { ...entry, sources: { question: paperObjectUrl(entry.documents.question.sha256), markscheme: paperObjectUrl(entry.documents.markscheme.sha256) } };
  const base = `/past-papers/${subjectSlugForBank(entry.summary.bankSlug)}/${paperSlug(entry.summary)}/document`;
  return { ...entry, sources: { question: `${base}?kind=question`, markscheme: `${base}?kind=markscheme` } };
}
export function findWholePaperBySlug(bank: BankSlug, slug: string): WholePaperDetail | null {
  const entry = readManifest(bank)?.papers.find(p => paperSlug(p.summary) === slug);
  return entry ? getWholePaper(bank, entry.summary.id) : null;
}
function safeRelativePath(v: unknown): v is string {
  return text(v, 2048) && !isAbsolute(v) && !/[\\\\:%?#]/.test(v) && v.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}
/** No symlink at any level, including configured-root ancestors. No unbounded file read. */
function checkedRead(path: string, limit: number): Buffer {
  const absolute = resolve(path);
  const chain = () => {
    let cursor = parse(absolute).root;
    const snapshots: string[] = [];
    for (const part of absolute.slice(cursor.length).split(sep)) {
      cursor = join(cursor, part);
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink()) throw new Error('Symlink rejected');
      snapshots.push(`${stat.dev}:${stat.ino}:${stat.mode}`);
    }
    if (realpathSync(absolute) !== absolute) throw new Error('Non-canonical path');
    return snapshots.join('|');
  };
  const before = chain();
  const fd = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    const target = lstatSync(absolute);
    if (!stat.isFile() || stat.size > limit || stat.ino !== target.ino || stat.dev !== target.dev) throw new Error('Invalid file');
    const bytes = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < bytes.length) { const n = readSync(fd, bytes, length, bytes.length - length, null); if (!n) break; length += n; }
    if (length !== stat.size || fstatSync(fd).size !== stat.size || chain() !== before) throw new Error('File changed');
    return bytes.subarray(0, length);
  } finally { closeSync(fd); }
}
function validBindings(value: unknown): value is import('./whole-paper-types').WholePaperLocalBindings {
  if (!object(value, ['roots', 'documents']) || !Array.isArray(value.roots) || !Array.isArray(value.documents) || value.roots.length > 100 || value.documents.length > 400_000) return false;
  const roots = new Set<string>();
  for (const r of value.roots) {
    if (!object(r, ['id', 'path']) || typeof r.id !== 'string' || !SAFE_ID.test(r.id) || roots.has(r.id) || !text(r.path, 2048) || !isAbsolute(r.path) || resolve(r.path) !== r.path || r.path === parse(r.path).root) return false;
    roots.add(r.id);
  }
  const ids = new Set<string>();
  for (const b of value.documents) {
    if (!object(b, ['bankSlug', 'paperId', 'kind', 'rootId', 'relativePath', 'sha256', 'bytes']) || typeof b.bankSlug !== 'string' || !BANK_CATALOG.some(bank => bank.slug === b.bankSlug) || typeof b.paperId !== 'string' || !SAFE_ID.test(b.paperId) || !['question', 'markscheme'].includes(b.kind as string) || typeof b.rootId !== 'string' || !roots.has(b.rootId) || !safeRelativePath(b.relativePath) || typeof b.sha256 !== 'string' || !SHA256.test(b.sha256) || !integer(b.bytes, 5, 100 * 1024 * 1024)) return false;
    const key = `${b.bankSlug}/${b.paperId}/${b.kind}`;
    if (ids.has(key)) return false; ids.add(key);
  }
  return true;
}
/** Every distinct approved PDF across the committed manifests; null if any manifest is invalid or a hash has two sizes. */
function approvedObjects(): Map<string, number> | null {
  const approved = new Map<string, number>();
  for (const bank of BANK_CATALOG) {
    const path = join(process.cwd(), 'src/data/paper-archives', `${bank.slug}.json`);
    try { lstatSync(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    const manifest = readManifest(bank.slug);
    if (!manifest) return null;
    for (const paper of manifest.papers) for (const doc of Object.values(paper.documents)) {
      if (approved.has(doc.sha256) && approved.get(doc.sha256) !== doc.bytes) return null;
      approved.set(doc.sha256, doc.bytes);
    }
  }
  return approved;
}
/** Production opens only when the committed receipt proves that every approved PDF was read back,
 * byte for byte, from free.pastpaperprep.com. Any manifest change closes it until a new readback. */
function productionEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production' || process.env.PAPER_ARCHIVE_ENABLED !== 'true' || process.env.PAPER_ARCHIVE_STORAGE_VERIFIED !== 'true') return false;
  try {
    const receipt: unknown = JSON.parse(checkedRead(join(process.cwd(), 'src/data/paper-archive-readback.json'), 64 * 1024).toString('utf8'));
    const approved = approvedObjects();
    return validPublicReadback(receipt) && !!approved?.size && receipt.objectCount === approved.size && receipt.objectsSha256 === paperObjectsDigest(approved);
  } catch { return false; }
}
/** Metadata alone is not a production activation proof. Does not perform a network call. */
export async function wholePaperArchiveEnabled(): Promise<boolean> { return wholePaperPreviewEnabled() || productionEnabled(); }
/** Local preview only. Production pages link the public bucket directly, so this route never runs there. */
export async function getWholePaperDocument(slug: string, id: string, kind: string): Promise<{bytes: Buffer; filename: string} | null> {
  if (!SAFE_ID.test(id) || (kind !== 'question' && kind !== 'markscheme')) return null;
  const entry = getWholePaper(slug, id);
  if (!entry) return null;
  if (!wholePaperPreviewEnabled()) return null;
  try {
    const bindings: unknown = JSON.parse(checkedRead(join(process.cwd(), 'private/paper-archives/source-bindings.json'), 32 * 1024 * 1024).toString('utf8'));
    if (!validBindings(bindings)) return null;
    const binding = bindings.documents.find(b => b.bankSlug === slug && b.paperId === id && b.kind === kind);
    const root = bindings.roots.find(r => r.id === binding?.rootId);
    const approved = entry.documents[kind];
    if (!binding || !root || binding.sha256 !== approved.sha256 || binding.bytes !== approved.bytes) return null;
    const path = resolve(root.path, binding.relativePath);
    const inside = relative(root.path, path);
    if (!inside || inside.startsWith(`..${sep}`) || isAbsolute(inside)) return null;
    const bytes = checkedRead(path, approved.bytes);
    if (bytes.length !== approved.bytes || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) || createHash('sha256').update(bytes).digest('hex') !== approved.sha256) return null;
    return { bytes, filename: `${id}-${kind}.pdf` };
  } catch { return null; }
}
