import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCatalogBank } from '@/lib/catalog';
import type { WholePaperDetail, WholePaperManifest } from '@/lib/whole-paper-types';
import { PastPaperPaperPage } from './PastPaperPaperPage';
import { IGCSE_PAPERS } from './fixtures';

vi.mock('./PaperWorkspace', () => ({ PaperWorkspace: ({ marking, practice, children }: { marking: unknown; practice: boolean; children: ReactNode }) => <div data-testid="workspace" data-marking={marking ? 'yes' : 'no'} data-practice={String(practice)}>{children}</div> }));
afterEach(() => cleanup());
const bank = getCatalogBank('igcse')!;
const summary = IGCSE_PAPERS.find(p => p.id === '0580-2024-june-42')!;
const detail: WholePaperDetail = { summary: { ...summary, maxMarks: 6 }, version: 'v1', documents: { question: { sha256: 'a'.repeat(64), bytes: 9, pages: 2 }, markscheme: { sha256: 'b'.repeat(64), bytes: 9, pages: 1 } }, questions: [{ id: 'q1', number: 1, maxMarks: 2, topics: ['Number'] }, { id: 'q2', number: 2, maxMarks: 4, topics: ['Algebra and graphs', 'Coordinate geometry'] }], sources: { question: '/q', markscheme: '/m' } };
const siblings = [...IGCSE_PAPERS, { ...summary, id: '0580-2024-june-41', component: '41', variant: '1' }, { ...summary, id: '0580-2024-june-22', component: '22', paper: '2' }];
const ldTypes = (container: HTMLElement) => [...container.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent ?? '{}')['@type']);

describe('PastPaperPaperPage', () => {
  it('names the paper, its facts and Cambridge file names', () => {
    const { container } = render(<PastPaperPaperPage view={{ kind: 'paper', bank, detail, all: siblings, practice: true }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'May/June 2024 Paper 42' })).toBeInTheDocument();
    const facts = screen.getByRole('list', { name: 'Paper facts' });
    for (const fact of ['Extended', '2 hours', '6 marks', 'Variant 2']) expect(within(facts).getByText(fact)).toBeInTheDocument();
    expect(screen.getByText('0580_s24_qp_42 · 0580_s24_ms_42')).toBeInTheDocument();
    expect(ldTypes(container)).toEqual(['BreadcrumbList', 'LearningResource']);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Past papers/Cambridge IGCSE/IGCSE Maths 0580/2024/Paper 42');
  });

  it('lists the questions with their topics and marks', () => {
    render(<PastPaperPaperPage view={{ kind: 'paper', bank, detail, all: siblings, practice: true }} />);
    const list = screen.getByRole('list', { name: 'Questions in this paper' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('Algebra and graphs, Coordinate geometry')).toBeInTheDocument();
    expect(within(list).getByText('4 marks')).toBeInTheDocument();
  });

  it('links variants, the same session, neighbouring sessions and practice', () => {
    render(<PastPaperPaperPage view={{ kind: 'paper', bank, detail, all: siblings, practice: true }} />);
    const variants = screen.getByRole('navigation', { name: 'Other variants' });
    expect(within(variants).getByRole('link', { name: '41' })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/2024-may-june-41');
    expect(within(variants).getByRole('link', { name: '42' })).toHaveAttribute('aria-current', 'page');
    expect(within(screen.getByRole('navigation', { name: 'Same session' })).getByRole('link', { name: '22' })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/2024-may-june-22');
    expect(screen.getByRole('link', { name: /Next.*Oct\/Nov 2025.*Paper 41/ })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/2025-oct-nov-41');
    expect(screen.getByRole('link', { name: 'All 2024 papers' })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/2024');
    expect(screen.getByRole('link', { name: 'Every Paper 4' })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/paper-4');
    expect(screen.getByRole('link', { name: /Practise Paper 4 questions by topic/ })).toHaveAttribute('href', '/banks/igcse?paper=4');
    expect(screen.getByTestId('workspace')).toHaveAttribute('data-marking', 'yes');
  });

  it('keeps the selected legacy IB Paper 3 option in neighbouring sessions', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'src/data/paper-archives/ib-hl.json'), 'utf8')) as WholePaperManifest;
    const entry = manifest.papers.find(p => p.summary.id === '2018-may-tz0-p3-discrete-mathematics')!;
    render(<PastPaperPaperPage view={{ kind: 'paper', bank: getCatalogBank('ib-hl')!, detail: { ...entry, sources: detail.sources }, all: manifest.papers.map(p => p.summary), practice: true }} />);
    const nav = screen.getByRole('navigation', { name: 'Paper 3 in other sessions' });
    expect(within(nav).getByRole('link', { name: /Previous/ })).toHaveAttribute('href', '/past-papers/ib-math-aa-hl/2017-november-paper-3-discrete-mathematics');
    expect(within(nav).getByRole('link', { name: /Next/ })).toHaveAttribute('href', '/past-papers/ib-math-aa-hl/2018-november-paper-3-discrete-mathematics');
  });

  it('offers no marking for held papers and never shows the internal reason', () => {
    const held = { ...detail, summary: { ...detail.summary, reportAvailable: false, reportReason: 'Printed and runtime question inventories do not reconcile.' }, questions: [] };
    render(<PastPaperPaperPage view={{ kind: 'paper', bank, detail: held, all: siblings, practice: true }} />);
    expect(screen.getByTestId('workspace')).toHaveAttribute('data-marking', 'no');
    expect(screen.queryByText(/reconcile/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Questions in this paper' })).not.toBeInTheDocument();
  });
  it('leaves out practice links when the bank has no question-bank page yet', () => {
    render(<PastPaperPaperPage view={{ kind: 'paper', bank, detail, all: siblings, practice: false }} />);
    expect(screen.queryByRole('link', { name: /questions by topic/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace')).toHaveAttribute('data-practice', 'false');
  });
  it('suggests same-session papers from the student\'s own route', () => {
    const sitting = [summary, { ...summary, id: '0580-2024-june-22', component: '22', paper: '2' }, { ...summary, id: '0580-2024-june-12', component: '12', paper: '1', route: 'Core' as const }, { ...summary, id: '0580-2024-june-32', component: '32', paper: '3', route: 'Core' as const }, { ...summary, id: '0580-2024-june-62', component: '62', paper: '6', route: 'Shared' as const }];
    render(<PastPaperPaperPage view={{ kind: 'paper', bank, detail, all: sitting, practice: true }} />);
    const same = screen.getByRole('navigation', { name: 'Same session' });
    expect(within(same).getAllByRole('link').map(a => a.textContent)).toEqual(['22', '62']);
    cleanup();
    const coreDetail = { ...detail, summary: sitting[2] };
    render(<PastPaperPaperPage view={{ kind: 'paper', bank, detail: coreDetail, all: sitting, practice: true }} />);
    expect(within(screen.getByRole('navigation', { name: 'Same session' })).getAllByRole('link').map(a => a.textContent)).toEqual(['32', '62']);
  });
});
