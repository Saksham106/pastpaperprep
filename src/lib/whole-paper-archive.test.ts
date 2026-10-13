// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { BANK_CATALOG } from './catalog';
import { getWholePaperBanks, getWholePaperSummaries, getWholePaper, getWholePaperDocument, wholePaperPreviewEnabled, wholePaperArchiveEnabled, findWholePaperBySlug } from './whole-paper-archive';

let root: string;
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const pdf = Buffer.from('%PDF-1.7\nfixture only\n%%EOF');
function fixture(slug = 'igcse') {
  const bank = BANK_CATALOG.find(b => b.slug === slug)!;
  return { version: 'v1', bankSlug: slug, runtimeSha256: 'a'.repeat(64), coverage: { paired: 1, reports: 1, held: 0, unpaired: 0, runtimeWithoutPair: 0 }, papers: [{ version: 'v1', summary: { id: 'paper-2025-21', bankSlug: slug, title: 'Paper 21', qualification: bank.qualification, subject: bank.subject, syllabusCode: bank.syllabusCode, year: 2025, session: 'May/June', sessionCode: 's', component: '21', paper: '2', variant: '1', route: 'Extended', durationMinutes: 90, maxMarks: 5, questionCount: 1, reportAvailable: true, metadataVerified: true }, documents: { question: { sha256: hash(pdf), bytes: pdf.length, pages: 1 }, markscheme: { sha256: hash(pdf), bytes: pdf.length, pages: 1 } }, questions: [{ id: 'question-1', number: 1, maxMarks: 5, topics: ['Algebra'], questionPage: 1 }] }] };
}
function manifest(value = fixture(), slug = value.bankSlug) {
  mkdirSync(join(root, 'src/data/paper-archives'), { recursive: true });
  writeFileSync(join(root, 'src/data/paper-archives', `${slug}.json`), JSON.stringify(value));
}
beforeEach(() => {
  const scratch = realpathSync(tmpdir());
  root = mkdtempSync(join(scratch, 'whole-paper-test-'));
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('LOCAL_PAPER_PREVIEW', 'true');
  vi.stubEnv('PAPER_ARCHIVE_ENABLED', 'false');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

const RECEIPT = 'src/data/paper-archive-readback.json';
type Ref = { bank: string; paper: string; kind: 'question' | 'markscheme'; sha: string; bytes: number };
const defaultRefs = (): Ref[] => (['question', 'markscheme'] as const).map(kind => ({ bank: 'igcse', paper: 'paper-2025-21', kind, sha: hash(pdf), bytes: pdf.length }));
function productionReceipt(refs: Ref[] = defaultRefs()) {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('PAPER_ARCHIVE_ENABLED', 'true'); vi.stubEnv('PAPER_ARCHIVE_STORAGE_VERIFIED', 'true');
  const objects = new Map(refs.map(r => [r.sha, r.bytes]));
  const mapping = hash(refs.map(r => `${r.bank}/${r.paper}/${r.kind} ${r.sha} ${r.bytes}\n`).sort().join(''));
  const receipt = { version: 3, status: 'verified_public_readback', origin: 'https://free.pastpaperprep.com', prefix: 'papers/v1/', verifiedAt: '2026-10-13T00:00:00.000Z', objectCount: objects.size, objectsSha256: hash([...objects].sort().map(([sha, bytes]) => `${sha} ${bytes}\n`).join('')), mappingSha256: mapping };
  saveReceipt(receipt);
  return receipt;
}
function saveReceipt(receipt: ReturnType<typeof productionReceipt>) {
  mkdirSync(join(root, 'src/data'), { recursive: true });
  writeFileSync(join(root, RECEIPT), JSON.stringify(receipt));
}
describe('production delivery from the public free bucket', () => {
  it('opens after a complete public readback and links each document straight to free.pastpaperprep.com', async () => {
    manifest(); productionReceipt();
    expect(await wholePaperArchiveEnabled()).toBe(true);
    const url = `https://free.pastpaperprep.com/papers/v1/${hash(pdf)}.pdf`;
    expect(getWholePaper('igcse', 'paper-2025-21')?.sources).toEqual({ question: url, markscheme: url });
  });
  it('never streams PDFs through the app in production', async () => {
    manifest(); bindings(); productionReceipt();
    expect(await getWholePaperDocument('igcse', 'paper-2025-21', 'question')).toBeNull();
  });
  it.each(['flag', 'verification', 'missing', 'malformed', 'digest', 'mapping', 'count', 'status', 'origin', 'newManifest', 'removedManifest', 'resized', 'conflict'])('stays closed for invalid %s proof', async mutation => {
    manifest(); const receipt = productionReceipt();
    if (mutation === 'digest') receipt.objectsSha256 = 'b'.repeat(64);
    if (mutation === 'mapping') receipt.mappingSha256 = 'b'.repeat(64);
    if (mutation === 'count') receipt.objectCount++;
    if (mutation === 'status') Object.assign(receipt, { status: 'pending_upload' });
    if (mutation === 'origin') Object.assign(receipt, { origin: 'https://pastpaperprep.com' });
    saveReceipt(receipt);
    if (mutation === 'flag') vi.stubEnv('PAPER_ARCHIVE_ENABLED', 'false');
    if (mutation === 'verification') vi.stubEnv('PAPER_ARCHIVE_STORAGE_VERIFIED', 'false');
    if (mutation === 'missing') rmSync(join(root, RECEIPT));
    if (mutation === 'malformed') writeFileSync(join(root, RECEIPT), '{broken');
    if (mutation === 'newManifest') { const other = fixture('ib-hl'); const bytes = Buffer.from('%PDF-1.7\nanother'); other.papers[0].documents.question = { sha256: hash(bytes), bytes: bytes.length, pages: 1 }; manifest(other); }
    if (mutation === 'removedManifest') rmSync(join(root, 'src/data/paper-archives/igcse.json'));
    if (mutation === 'resized' || mutation === 'conflict') {
      const m = fixture(); m.papers[0].documents.markscheme = { ...m.papers[0].documents.markscheme, bytes: pdf.length + 1 };
      if (mutation === 'resized') m.papers[0].documents.question = m.papers[0].documents.markscheme;
      manifest(m);
    }
    expect(await wholePaperArchiveEnabled()).toBe(false);
  });
  it('accepts a second bank only once the receipt covers its documents', async () => {
    const other = fixture('ib-hl'); const bytes = Buffer.from('%PDF-1.7\nanother'); other.papers[0].documents.question = { sha256: hash(bytes), bytes: bytes.length, pages: 1 };
    manifest(); manifest(other);
    productionReceipt([...defaultRefs(), { bank: 'ib-hl', paper: 'paper-2025-21', kind: 'question', sha: hash(bytes), bytes: bytes.length }, { bank: 'ib-hl', paper: 'paper-2025-21', kind: 'markscheme', sha: hash(pdf), bytes: pdf.length }]);
    expect(await wholePaperArchiveEnabled()).toBe(true);
  });
  it('stays closed when a question paper and mark scheme swap PDFs after the readback', async () => {
    const ms = Buffer.from('%PDF-1.7\nmark scheme');
    const m = fixture(); m.papers[0].documents.markscheme = { sha256: hash(ms), bytes: ms.length, pages: 1 };
    manifest(m);
    productionReceipt([{ bank: 'igcse', paper: 'paper-2025-21', kind: 'question', sha: hash(pdf), bytes: pdf.length }, { bank: 'igcse', paper: 'paper-2025-21', kind: 'markscheme', sha: hash(ms), bytes: ms.length }]);
    expect(await wholePaperArchiveEnabled()).toBe(true);
    const swapped = fixture(); swapped.papers[0].documents.question = m.papers[0].documents.markscheme; swapped.papers[0].documents.markscheme = m.papers[0].documents.question;
    manifest(swapped);
    expect(await wholePaperArchiveEnabled()).toBe(false);
  });
});

function bindings(relativePath = 'paper.pdf') {
  const sources = join(root, 'sources'); mkdirSync(sources, { recursive: true }); writeFileSync(join(sources, 'paper.pdf'), pdf);
  const value = { roots: [{ id: 'fixture', path: sources }], documents: (['question', 'markscheme'] as const).map(kind => ({ bankSlug: 'igcse', paperId: 'paper-2025-21', kind, rootId: 'fixture', relativePath, sha256: hash(pdf), bytes: pdf.length })) };
  mkdirSync(join(root, 'private/paper-archives'), { recursive: true });
  writeFileSync(join(root, 'private/paper-archives/source-bindings.json'), JSON.stringify(value));
  return value;
}
describe('local hash-pinned PDF delivery', () => {
  it('delivers the exact approved PDF through private root bindings', async () => {
    manifest(); bindings();
    expect(await getWholePaperDocument('igcse', 'paper-2025-21', 'question')).toEqual({ bytes: pdf, filename: 'paper-2025-21-question.pdf' });
    expect(await getWholePaperDocument('igcse', 'paper-2025-21', 'markscheme')).toEqual({ bytes: pdf, filename: 'paper-2025-21-markscheme.pdf' });
  });
  it.each(['production', 'test'])('never uses local bindings in %s', async mode => {
    manifest(); bindings(); vi.stubEnv('NODE_ENV', mode);
    vi.stubEnv('PAPER_ARCHIVE_ENABLED', 'true'); vi.stubEnv('PAPER_ARCHIVE_STORAGE_VERIFIED', 'true');
    expect(wholePaperPreviewEnabled()).toBe(false);
    expect(await getWholePaperDocument('igcse', 'paper-2025-21', 'question')).toBeNull();
  });
  it('requires the exact local opt-in flag', async () => {
    manifest(); bindings(); vi.stubEnv('LOCAL_PAPER_PREVIEW', 'TRUE');
    expect(wholePaperPreviewEnabled()).toBe(false);
    expect(await getWholePaperDocument('igcse', 'paper-2025-21', 'question')).toBeNull();
  });
  it.each(['../sources/paper.pdf', '/paper.pdf', 'nested/../paper.pdf', 'https://example.com/paper.pdf', 'nested\\paper.pdf'])('rejects non-canonical binding path %s', async relativePath => {
    manifest(); bindings(relativePath);
    expect(await getWholePaperDocument('igcse', 'paper-2025-21', 'question')).toBeNull();
  });
  it.each(['hash', 'bytes', 'header', 'highBitHeader', 'bindingHash', 'duplicate', 'symlinkFile', 'symlinkDirectory', 'symlinkRoot', 'missing'])('fails closed for %s', async mutation => {
    manifest(); const b = bindings();
    const path = join(root, 'private/paper-archives/source-bindings.json');
    if (mutation === 'hash') writeFileSync(join(root, 'sources/paper.pdf'), Buffer.from('%PDF-1.7\nchanged bytes'));
    if (mutation === 'bytes') { b.documents[0].bytes++; }
    if (mutation === 'bindingHash') b.documents[0].sha256 = 'b'.repeat(64);
    if (mutation === 'header' || mutation === 'highBitHeader') {
      const bad = mutation === 'header' ? Buffer.from('not a PDF') : Buffer.from(pdf);
      if (mutation === 'highBitHeader') for (let i = 0; i < 5; i++) bad[i] |= 0x80;
      const m = fixture(); m.papers[0].documents.question = { sha256: hash(bad), bytes: bad.length, pages: 1 }; manifest(m);
      b.documents[0].sha256 = hash(bad); b.documents[0].bytes = bad.length; writeFileSync(join(root, 'sources/paper.pdf'), bad);
    }
    if (mutation === 'duplicate') b.documents.push(b.documents[0]);
    if (mutation === 'missing') b.documents[0].relativePath = 'missing.pdf';
    if (mutation === 'symlinkFile') { symlinkSync(join(root, 'sources/paper.pdf'), join(root, 'sources/link.pdf')); b.documents[0].relativePath = 'link.pdf'; }
    if (mutation === 'symlinkDirectory') { symlinkSync(join(root, 'sources'), join(root, 'sources/alias')); b.documents[0].relativePath = 'alias/paper.pdf'; }
    if (mutation === 'symlinkRoot') { symlinkSync(join(root, 'sources'), join(root, 'linkedroot')); b.roots[0].path = join(root, 'linkedroot'); }
    writeFileSync(path, JSON.stringify(b));
    expect(await getWholePaperDocument('igcse', 'paper-2025-21', 'question')).toBeNull();
  });
  it('rejects unknown kinds, unknown pairs and missing bindings', async () => {
    manifest();
    for (const [slug, id, kind] of [['igcse', 'paper-2025-21', 'question'], ['igcse', 'paper-2025-21', 'question?url=x'], ['../igcse', 'paper-2025-21', 'question'], ['igcse', '../paper-2025-21', 'question']]) expect(await getWholePaperDocument(slug, id, kind)).toBeNull();
  });
});

describe('whole-paper public registry', () => {
  it('exposes an asynchronous gate and permits only explicit development preview', async () => {
    expect(wholePaperArchiveEnabled()).toBeInstanceOf(Promise);
    expect(await wholePaperArchiveEnabled()).toBe(true);
    vi.stubEnv('LOCAL_PAPER_PREVIEW', 'false');
    expect(await wholePaperArchiveEnabled()).toBe(false);
  });
  it('preserves source question counts on PDF-only papers with no trusted scoring projection', async () => {
    const m=fixture();m.coverage.reports=0;m.coverage.held=1;m.papers[0].summary.reportAvailable=false;m.papers[0].summary.questionCount=7;m.papers[0].questions=[];
    manifest(m);bindings();
    expect(getWholePaperSummaries('igcse')).toHaveLength(1);
    expect(getWholePaper('igcse','paper-2025-21')?.summary).toMatchObject({questionCount:7,reportAvailable:false});
    expect(await getWholePaperDocument('igcse','paper-2025-21','question')).not.toBeNull();
  });
  it('rejects symlinked public manifests', () => {
    manifest(); const path = join(root, 'src/data/paper-archives/igcse.json');
    writeFileSync(join(root, 'elsewhere.json'), JSON.stringify(fixture()));
    rmSync(path); symlinkSync(join(root, 'elsewhere.json'), path);
    expect(getWholePaperSummaries('igcse')).toEqual([]);
  });
  it('never substitutes catalogue paper counts for unavailable archive manifests', () => {
    const empty = getWholePaperBanks();
    expect(empty).toHaveLength(19);
    expect(empty.every(b => b.paperCount === 0 && b.reportCount === 0 && !b.available)).toBe(true);
    for (const bank of BANK_CATALOG) manifest(fixture(bank.slug));
    const available = getWholePaperBanks();
    expect(available.map(b => b.bankSlug)).toEqual(BANK_CATALOG.map(b => b.slug));
    expect(available.every(b => b.paperCount === 1 && b.reportCount === 1 && b.available)).toBe(true);
  });
  it('enumerates every canonical bank, reads compact metadata and uses internal document URLs in local preview', () => {
    manifest();
    expect(getWholePaperBanks().map(b => b.bankSlug)).toEqual(BANK_CATALOG.map(b => b.slug));
    expect(getWholePaperBanks().find(b => b.bankSlug === 'igcse')).toMatchObject({ paperCount: 1, reportCount: 1, available: true, years: '2025' });
    expect(getWholePaperSummaries('igcse')).toEqual([fixture().papers[0].summary]);
    expect(getWholePaper('igcse', 'paper-2025-21')).toMatchObject({ sources: { question: '/past-papers/igcse-maths-0580/2025-may-june-21/document?kind=question', markscheme: '/past-papers/igcse-maths-0580/2025-may-june-21/document?kind=markscheme' } });
    expect(getWholePaperSummaries('ib-hl')).toEqual([]);
  });
  it('finds papers by their public slug and nothing else', () => {
    manifest();
    expect(findWholePaperBySlug('igcse', '2025-may-june-21')?.summary.id).toBe('paper-2025-21');
    for (const slug of ['paper-2025-21', '2025-may-june-22', '', '../2025-may-june-21']) expect(findWholePaperBySlug('igcse', slug)).toBeNull();
    expect(findWholePaperBySlug('ib-hl', '2025-may-june-21')).toBeNull();
  });
  it('parses an unchanged manifest once and re-reads it after it changes', () => {
    manifest();
    const first = getWholePaper('igcse', 'paper-2025-21');
    expect(getWholePaper('igcse', 'paper-2025-21')?.questions).toBe(first?.questions);
    const changed = fixture(); changed.papers[0].summary.title = 'Paper 21 (changed title)'; manifest(changed);
    expect(getWholePaper('igcse', 'paper-2025-21')?.summary.title).toBe('Paper 21 (changed title)');
  });
  it.each([
    ['duplicate papers', (m: ReturnType<typeof fixture>) => m.papers.push(m.papers[0])],
    ['wrong bank', (m: ReturnType<typeof fixture>) => { m.bankSlug = 'ib-hl'; }],
    ['unsafe id', (m: ReturnType<typeof fixture>) => { m.papers[0].summary.id = '../secret'; }],
    ['bad hash', (m: ReturnType<typeof fixture>) => { m.papers[0].documents.question.sha256 = 'A'.repeat(64); }],
    ['bad bytes', (m: ReturnType<typeof fixture>) => { m.papers[0].documents.question.bytes = -1; }],
    ['count mismatch', (m: ReturnType<typeof fixture>) => { m.papers[0].summary.questionCount = 2; }],
    ['coverage mismatch', (m: ReturnType<typeof fixture>) => { m.coverage.paired = 2; }],
    ['report count mismatch', (m: ReturnType<typeof fixture>) => { m.coverage.reports = 0; }],
    ['empty report topics', (m: ReturnType<typeof fixture>) => { m.papers[0].questions[0].topics=[]; }],
    ['held coverage mismatch', (m: ReturnType<typeof fixture>) => { m.coverage.held=1; }],
    ['bad marks', (m: ReturnType<typeof fixture>) => { m.papers[0].questions[0].maxMarks = -1; }],
    ['unreconciled max', (m: ReturnType<typeof fixture>) => { m.papers[0].summary.maxMarks = 6; }],
    ['unverified report', (m: ReturnType<typeof fixture>) => { m.papers[0].summary.metadataVerified = false; }],
    ['duplicate questions', (m: ReturnType<typeof fixture>) => { m.papers[0].questions.push(m.papers[0].questions[0]); m.papers[0].summary.questionCount = 2; m.papers[0].summary.maxMarks = 10; }],
    ['out of bounds page', (m: ReturnType<typeof fixture>) => { m.papers[0].questions[0].questionPage = 2; }],
    ['protected field', (m: ReturnType<typeof fixture>) => { Object.assign(m.papers[0].questions[0], { questionText: 'PRIVATE' }); }],
    ['source path', (m: ReturnType<typeof fixture>) => { Object.assign(m.papers[0], { sources: { question: '/private/original.pdf' } }); }],
    ['missing field', (m: ReturnType<typeof fixture>) => { Reflect.deleteProperty(m.papers[0].summary, 'year'); }],
  ])('fails closed for %s', (_label, mutate) => {
    const m = fixture(); mutate(m); manifest(m, 'igcse');
    expect(getWholePaperSummaries('igcse')).toEqual([]);
    expect(getWholePaper('igcse', 'paper-2025-21')).toBeNull();
  });
  it('rejects malformed JSON and exact invalid lookup tokens without normalization', () => {
    manifest();
    for (const slug of ['IGCSE', '../igcse', 'igcse?x=1', 'unknown']) expect(getWholePaperSummaries(slug)).toEqual([]);
    for (const id of ['PAPER-2025-21', 'paper-2025-21?x=1', '../paper-2025-21', 'a'.repeat(161)]) expect(getWholePaper('igcse', id)).toBeNull();
    writeFileSync(join(root, 'src/data/paper-archives/igcse.json'), '{broken');
    expect(getWholePaperSummaries('igcse')).toEqual([]);
  });
});
