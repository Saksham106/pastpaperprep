// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WholePaperSummary } from './whole-paper-types';
const archive = vi.hoisted(() => ({ enabled: vi.fn(), summaries: vi.fn(), find: vi.fn() }));
vi.mock('./whole-paper-archive', () => ({ wholePaperArchiveEnabled: archive.enabled, getWholePaperSummaries: archive.summaries, findWholePaperBySlug: archive.find }));
const explanations = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./free-explanations', () => ({ freeExplanations: () => ({ get: explanations.get }) }));
import { pastPaperFallback, pastPaperSitemapPaths, resolveEntry, resolveSubject } from './past-paper-pages';

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
    expect(paths).toContain('/past-papers/igcse-chemistry-0620/2024-may-june-23');
    expect(paths).toContain('/past-papers/igcse-chemistry-0620/paper-2');
    expect(paths).not.toContain('/past-papers/igcse-chemistry-0620/2019');
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
