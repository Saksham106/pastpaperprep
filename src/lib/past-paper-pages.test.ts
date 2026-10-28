// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WholePaperSummary } from './whole-paper-types';
const archive = vi.hoisted(() => ({ enabled: vi.fn(), summaries: vi.fn(), find: vi.fn() }));
vi.mock('./whole-paper-archive', () => ({ wholePaperArchiveEnabled: archive.enabled, getWholePaperSummaries: archive.summaries, findWholePaperBySlug: archive.find }));
import { pastPaperFallback, resolveEntry, resolveSubject } from './past-paper-pages';

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
