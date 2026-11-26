// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WholePaperSummary } from './whole-paper-types';
const archive = vi.hoisted(() => ({ enabled: vi.fn(), summaries: vi.fn(), find: vi.fn() }));
vi.mock('./whole-paper-archive', () => ({ wholePaperArchiveEnabled: archive.enabled, getWholePaperSummaries: archive.summaries, findWholePaperBySlug: archive.find }));
const explanations = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./free-explanations', () => ({ freeExplanations: () => ({ get: explanations.get }) }));
import { NOINDEX_SITEMAP_BANKS, paperQuestions, pastPaperFallback, pastPaperNoindexEntries, pastPaperSitemapPaths, resolveEntry, resolveSubject } from './past-paper-pages';
import { completeInventory } from './past-paper-insights';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const paper = (bankSlug: WholePaperSummary['bankSlug']): WholePaperSummary => ({ id: 'p', bankSlug, title: 't', qualification: 'Cambridge IGCSE', subject: 'Biology', syllabusCode: '0610', year: 2024, session: 'May/June', sessionCode: 's', component: '42', paper: '4', variant: '2', route: 'Extended', durationMinutes: 75, maxMarks: 80, questionCount: 1, reportAvailable: true, metadataVerified: true });
beforeEach(() => { archive.enabled.mockResolvedValue(true); archive.summaries.mockImplementation((bank: WholePaperSummary['bankSlug']) => [paper(bank)]); });
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe('practice links only where a bank page exists', () => {
  it('offers practice for banks the site shows', async () => {
    expect((await resolveSubject('igcse-maths-0580'))?.practice).toBe(true);
  });
  it('withholds practice for banks without a /banks page', async () => {
    // 0610 has no /banks page while its release gate is off; pin that regardless of the ambient env.
    vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS', 'false');
    expect((await resolveSubject('igcse-biology-0610'))?.practice).toBe(false);
    expect((await resolveEntry('igcse-biology-0610', '2024'))?.practice).toBe(false);
  });
});

describe('temporary noindex sitemap scope', () => {
  it('names only real banks whose paper pages were indexable before the first cut', async () => {
    const { BANK_CATALOG } = await import('./catalog');
    const slugs = new Set<string>(BANK_CATALOG.map(b => b.slug));
    for (const slug of NOINDEX_SITEMAP_BANKS) expect(slugs.has(slug)).toBe(true);
    expect([...NOINDEX_SITEMAP_BANKS].some(s => s.startsWith('a-level') || s.startsWith('ib-business'))).toBe(false);
  });
});

describe('guessed entries under a real subject', () => {
  it('redirects to the real paper, else the subject list, and leaves unknown subjects as 404', async () => {
    expect(await pastPaperFallback('igcse-maths-0580', '2024-May-June-42')).toEqual({ href: '/past-papers/igcse-maths-0580/2024-may-june-42', permanent: true });
    expect(await pastPaperFallback('igcse-maths-0580', '2024-may-june-43')).toEqual({ href: '/past-papers/igcse-maths-0580/2024', permanent: false });
    expect(await pastPaperFallback('igcse-maths-0580', 'nonsense')).toEqual({ href: '/past-papers/igcse-maths-0580', permanent: false });
    expect(await pastPaperFallback('igcse-0580', '2024')).toBeNull();
  });
});

describe('indexing measures worked answers against the whole paper', () => {
  // A held paper: the archive knows 40 questions but only 28 were imported (as in 0620/23 May/June 2019).
  const held = { ...paper('igcse-chemistry-0620'), id: '0620-2019-june-23', year: 2019, component: '23', paper: '2', variant: '3', questionCount: 40, maxMarks: 40, reportAvailable: false };
  const latest = { ...held, id: '0620-2024-june-23', year: 2024 };
  const detail = (summary: WholePaperSummary, n: number) => ({ summary, version: 'v', documents: { question: { sha256: 'a'.repeat(64), bytes: 1, pages: 1 }, markscheme: { sha256: 'b'.repeat(64), bytes: 1, pages: 1 } }, sources: { question: '/q', markscheme: '/m' },
    questions: Array.from({ length: n }, (_, i) => ({ id: `0620-2019-s-23-q${i + 1}`, number: i + 1, maxMarks: 1, topics: ['Stoichiometry'] })) });
  beforeEach(() => {
    vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS', 'true');
    vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED', 'true');
    archive.summaries.mockReturnValue([held, latest]);
    explanations.get.mockImplementation(() => ({ schemaVersion: 1, parts: [] }));
  });

  it('keeps a partial import with 28 of 40 answered out of the index and the sitemap', async () => {
    archive.find.mockImplementation((_bank: string, slug: string) => slug === '2019-may-june-23' ? detail(held, 28) : slug === '2024-may-june-23' ? detail(latest, 28) : null);
    const view = await resolveEntry('igcse-chemistry-0620', '2019-may-june-23');
    expect(view?.kind === 'paper' && view.indexing).toEqual({ indexed: false, reason: null });
    expect(view?.kind === 'paper' && view.complete).toBe(false);
    const paths = await pastPaperSitemapPaths();
    expect(paths).not.toContain('/past-papers/igcse-chemistry-0620/2019-may-june-23');
    // The latest year's papers are listed through that year's page, not one by one.
    expect(paths).not.toContain('/past-papers/igcse-chemistry-0620/2024-may-june-23');
    expect(paths).toContain('/past-papers/igcse-chemistry-0620/2024');
    expect(paths).toContain('/past-papers/igcse-chemistry-0620/paper-2');
    expect(paths).not.toContain('/past-papers/igcse-chemistry-0620/2019');
    // The temporary noindex sitemap lists exactly the pages left out, dated when each switched to noindex.
    const noindex = await pastPaperNoindexEntries();
    expect(noindex).toEqual(expect.arrayContaining([
      { path: '/past-papers/igcse-chemistry-0620/2019', lastModified: '2026-11-07' },
      { path: '/past-papers/igcse-chemistry-0620/2019-may-june-23', lastModified: '2026-11-07' },
      { path: '/past-papers/igcse-chemistry-0620/2024-may-june-23', lastModified: '2026-11-21' },
    ]));
    for (const { path } of noindex) expect(paths).not.toContain(path);
    expect(noindex.map(e => e.path)).not.toContain('/past-papers/igcse-chemistry-0620/2024');
  });

  it('indexes the same paper once its whole inventory is answered, and treats an unknown count conservatively', async () => {
    archive.find.mockImplementation(() => detail(held, 40));
    const full = await resolveEntry('igcse-chemistry-0620', '2019-may-june-23');
    expect(full?.kind === 'paper' && full.indexing).toEqual({ indexed: true, reason: 'worked-answers' });
    expect(full?.kind === 'paper' && full.complete).toBe(true);
    archive.summaries.mockReturnValue([{ ...held, questionCount: 0 }, latest]);
    archive.find.mockImplementation(() => detail({ ...held, questionCount: 0 }, 40));
    const unknown = await resolveEntry('igcse-chemistry-0620', '2019-may-june-23');
    expect(unknown?.kind === 'paper' && unknown.indexing?.indexed).toBe(false);
  });
});

describe('PDF-only reprinted variants list the questions their runtime aliases name', () => {
  const manifest = (bank: string) => JSON.parse(readFileSync(`src/data/paper-archives/${bank}.json`, 'utf8')) as { papers: { summary: WholePaperSummary; version: string; documents: never; questions: never[] }[] };
  const held = (bank: WholePaperSummary['bankSlug'], id: string) => {
    const entry = manifest(bank).papers.find(e => e.summary.id === id)!;
    expect(entry.summary.reportAvailable).toBe(false); // self-marking stays held
    return { ...entry, sources: { question: '/q', markscheme: '/m' } };
  };
  it.each([
    ['a-level-economics-9708', '9708-2024-s-43', '9708-2024-s-41', 5],
    ['a-level-biology-9700', '9700-2021-w-43', '9700-2021-w-41', 10],
  ] as const)('%s %s recovers its %s rows under its own printed numbers', (bank, id, canonical, count) => {
    const detail = held(bank, id);
    const rows = paperQuestions(bank, detail);
    expect(rows.map(q => q.number)).toEqual(Array.from({ length: count }, (_, i) => i + 1));
    expect(rows.map(q => q.id)).toEqual(rows.map(q => `${canonical}-q${q.number}`));
    expect(rows.every(q => q.topics.length > 0 && q.marks !== null)).toBe(true);
    // Judged exactly like the canonical variant's own rows (these optional-choice papers are never "complete").
    const own = paperQuestions(bank, held(bank, canonical));
    expect(rows.map(q => [q.number, q.marks, q.topics])).toEqual(own.map(q => [q.number, q.marks, q.topics]));
    expect(completeInventory(detail.summary, rows)).toBe(completeInventory(held(bank, canonical).summary, own));
  });
  it('recovers only the rows the bank has, and does not claim the whole paper (9708-2025-s-43)', () => {
    const detail = held('a-level-economics-9708', '9708-2025-s-43');
    const rows = paperQuestions('a-level-economics-9708', detail);
    expect(rows).toHaveLength(4);
    expect(detail.summary.questionCount).toBe(5);
    expect(completeInventory(detail.summary, rows)).toBe(false);
  });
  it('keeps the committed alias map in step with the runtimes', () => {
    expect(() => execFileSync('node', ['scripts/generate-reprint-aliases.mjs', '--check'], { encoding: 'utf8' })).not.toThrow();
  });
});
