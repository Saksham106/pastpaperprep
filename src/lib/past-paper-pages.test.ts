// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WholePaperSummary } from './whole-paper-types';
const archive = vi.hoisted(() => ({ enabled: vi.fn(), summaries: vi.fn(), find: vi.fn() }));
vi.mock('./whole-paper-archive', () => ({ wholePaperArchiveEnabled: archive.enabled, getWholePaperSummaries: archive.summaries, findWholePaperBySlug: archive.find }));
import { resolveEntry, resolveSubject } from './past-paper-pages';

const paper = (bankSlug: WholePaperSummary['bankSlug']): WholePaperSummary => ({ id: 'p', bankSlug, title: 't', qualification: 'Cambridge IGCSE', subject: 'Biology', syllabusCode: '0610', year: 2024, session: 'May/June', sessionCode: 's', component: '42', paper: '4', variant: '2', route: 'Extended', durationMinutes: 75, maxMarks: 80, questionCount: 1, reportAvailable: true, metadataVerified: true });
beforeEach(() => { archive.enabled.mockResolvedValue(true); archive.summaries.mockImplementation((bank: WholePaperSummary['bankSlug']) => [paper(bank)]); });
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe('practice links only where a bank page exists', () => {
  it('offers practice for banks the site shows', async () => {
    expect((await resolveSubject('igcse-maths-0580'))?.practice).toBe(true);
  });
  it('withholds practice for banks without a /banks page', async () => {
    expect((await resolveSubject('igcse-biology-0610'))?.practice).toBe(false);
    expect((await resolveEntry('igcse-biology-0610', '2024'))?.practice).toBe(false);
  });
});
