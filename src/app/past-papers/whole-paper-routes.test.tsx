import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { getCatalogBank } from '@/lib/catalog';
import type { WholePaperDetail, WholePaperSummary } from '@/lib/whole-paper-types';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
const pages = vi.hoisted(() => ({ hubBanks: vi.fn(), resolveSubject: vi.fn(), resolveEntry: vi.fn(), pastPaperParams: vi.fn() }));
vi.mock('@/lib/past-paper-pages', () => pages);
vi.mock('@/components/past-papers/PastPaperHub', () => ({ PastPaperHub: ({ qualification }: { qualification?: string }) => <div data-testid="hub">{qualification ?? 'all'}</div> }));
vi.mock('@/components/past-papers/PastPaperListPage', () => ({ PastPaperListPage: ({ view }: { view: { kind: string } }) => <div data-testid="list">{view.kind}</div> }));
vi.mock('@/components/past-papers/PastPaperPaperPage', () => ({ PastPaperPaperPage: ({ view }: { view: { detail: WholePaperDetail } }) => <div data-testid="paper">{view.detail.summary.id}</div> }));
import Hub, { generateMetadata as hubMetadata } from './page';
import SlugPage, { generateMetadata as slugMetadata, generateStaticParams as slugParams } from './[slug]/page';
import EntryPage, { generateMetadata as entryMetadata, generateStaticParams as entryParams } from './[slug]/[entry]/page';

const bank = getCatalogBank('igcse')!;
const paper: WholePaperSummary = { id: '0580-2024-june-42', bankSlug: 'igcse', title: 'Mathematics 0580 · May/June 2024 · Paper 42', qualification: 'Cambridge IGCSE', subject: 'Mathematics', syllabusCode: '0580', year: 2024, session: 'May/June', sessionCode: 's', component: '42', paper: '4', variant: '2', route: 'Extended', durationMinutes: 150, maxMarks: 130, questionCount: 1, reportAvailable: true, metadataVerified: true };
const detail: WholePaperDetail = { summary: paper, version: 'v1', documents: { question: { sha256: 'a'.repeat(64), bytes: 9, pages: 1 }, markscheme: { sha256: 'b'.repeat(64), bytes: 9, pages: 1 } }, questions: [], sources: { question: '/q', markscheme: '/m' } };
const hubBank = { bankSlug: 'igcse', subjectSlug: 'igcse-maths-0580', name: 'IGCSE Maths 0580', qualification: 'igcse', paperCount: 1, years: '2024', tone: 'math' };
const params = <T,>(value: T) => ({ params: Promise.resolve(value) });

beforeEach(() => {
  vi.resetAllMocks();
  pages.hubBanks.mockResolvedValue([hubBank]);
  pages.resolveSubject.mockResolvedValue({ kind: 'subject', bank, papers: [paper] });
  pages.pastPaperParams.mockResolvedValue({ slugs: ['igcse', 'igcse-maths-0580'], entries: [{ slug: 'igcse-maths-0580', entry: '2024' }] });
});
afterEach(() => cleanup());

describe('free past-paper routes', () => {
  it('builds nothing and 404s everywhere while the archive is off', async () => {
    pages.hubBanks.mockResolvedValue([]); pages.resolveSubject.mockResolvedValue(null); pages.resolveEntry.mockResolvedValue(null);
    pages.pastPaperParams.mockResolvedValue({ slugs: [], entries: [] });
    expect(await slugParams()).toEqual([]);
    expect(await entryParams()).toEqual([]);
    await expect(Hub()).rejects.toThrow('NOT_FOUND');
    await expect(SlugPage(params({ slug: 'igcse' }))).rejects.toThrow('NOT_FOUND');
    await expect(SlugPage(params({ slug: 'igcse-maths-0580' }))).rejects.toThrow('NOT_FOUND');
    await expect(EntryPage(params({ slug: 'igcse-maths-0580', entry: '2024' }))).rejects.toThrow('NOT_FOUND');
  });

  it('pre-builds exactly the resolver params', async () => {
    expect(await slugParams()).toEqual([{ slug: 'igcse' }, { slug: 'igcse-maths-0580' }]);
    expect(await entryParams()).toEqual([{ slug: 'igcse-maths-0580', entry: '2024' }]);
  });

  it('renders the hub, qualification hubs and subject pages', async () => {
    render(await Hub()); expect(screen.getByTestId('hub')).toHaveTextContent('all'); cleanup();
    render(await SlugPage(params({ slug: 'igcse' }))); expect(screen.getByTestId('hub')).toHaveTextContent('igcse');
    expect(pages.hubBanks).toHaveBeenLastCalledWith('igcse'); cleanup();
    render(await SlugPage(params({ slug: 'igcse-maths-0580' }))); expect(screen.getByTestId('list')).toHaveTextContent('subject');
  });

  it('renders year, paper-number and paper entries', async () => {
    pages.resolveEntry.mockResolvedValueOnce({ kind: 'year', bank, year: 2024, papers: [paper], all: [paper] });
    render(await EntryPage(params({ slug: 'igcse-maths-0580', entry: '2024' }))); expect(screen.getByTestId('list')).toHaveTextContent('year'); cleanup();
    pages.resolveEntry.mockResolvedValueOnce({ kind: 'paperNumber', bank, paper: '4', papers: [paper], all: [paper] });
    render(await EntryPage(params({ slug: 'igcse-maths-0580', entry: 'paper-4' }))); expect(screen.getByTestId('list')).toHaveTextContent('paperNumber'); cleanup();
    pages.resolveEntry.mockResolvedValueOnce({ kind: 'paper', bank, detail, all: [paper] });
    render(await EntryPage(params({ slug: 'igcse-maths-0580', entry: '2024-may-june-42' }))); expect(screen.getByTestId('paper')).toHaveTextContent('0580-2024-june-42');
    expect(pages.resolveEntry).toHaveBeenLastCalledWith('igcse-maths-0580', '2024-may-june-42');
  });

  it('writes canonical metadata without doubling the site name', async () => {
    pages.resolveEntry.mockResolvedValue({ kind: 'paper', bank, detail, all: [paper] });
    const all = [await hubMetadata(), await slugMetadata(params({ slug: 'igcse' })), await slugMetadata(params({ slug: 'igcse-maths-0580' })), await entryMetadata(params({ slug: 'igcse-maths-0580', entry: '2024-may-june-42' }))];
    const text = (title: unknown) => typeof title === 'string' ? title : (title as { absolute: string }).absolute;
    for (const m of all) expect(text(m.title)).not.toMatch(/PastPaperPrep/);
    // Titles that would run past 60 characters with " | PastPaperPrep" skip the suffix.
    for (const m of all) if (typeof m.title === 'string') expect(`${m.title} | PastPaperPrep`.length).toBeLessThanOrEqual(60);
    expect(all[2]).toMatchObject({ title: { absolute: 'IGCSE Maths 0580 Past Papers & Mark Schemes (2024)' }, alternates: { canonical: '/past-papers/igcse-maths-0580' } });
    expect(all[3]).toMatchObject({ title: { absolute: '0580/42 May/June 2024: IGCSE Maths Paper 4 & Mark Scheme' }, alternates: { canonical: '/past-papers/igcse-maths-0580/2024-may-june-42' } });
    for (const m of all) expect(m).toMatchObject({ openGraph: { siteName: 'PastPaperPrep', type: 'website', images: [expect.objectContaining({ url: expect.any(String) })] }, twitter: { card: 'summary_large_image', title: text(m.title) } });
  });
});
