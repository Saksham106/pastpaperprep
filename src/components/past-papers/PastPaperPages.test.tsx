import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { getCatalogBank } from '@/lib/catalog';
import type { HubBank } from '@/lib/past-paper-pages';
import { PastPaperHub } from './PastPaperHub';
import { PastPaperListPage } from './PastPaperListPage';
import { IGCSE_PAPERS } from './fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/product-analytics', () => ({ trackProductEvent: vi.fn() }));
afterEach(() => cleanup());
const bank = getCatalogBank('igcse')!;
const hubBanks: HubBank[] = [
  { bankSlug: 'igcse', subjectSlug: 'igcse-maths-0580', name: 'IGCSE Maths 0580', qualification: 'igcse', paperCount: 216, years: '2016–2026', tone: 'math' },
  { bankSlug: 'igcse-chemistry-0620', subjectSlug: 'igcse-chemistry-0620', name: 'IGCSE Chemistry 0620', qualification: 'igcse', paperCount: 314, years: '2019–2026', tone: 'chemistry' },
  { bankSlug: 'ib-hl', subjectSlug: 'ib-math-aa-hl', name: 'IB Math AA HL', qualification: 'ib', paperCount: 98, years: '2017–2026', tone: 'math' },
];
const ldTypes = (container: HTMLElement) => [...container.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent ?? '{}')['@type']);

describe('PastPaperHub', () => {
  it('groups subjects into pastel cards that open each subject page', () => {
    const { container } = render(<PastPaperHub banks={hubBanks} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Free IGCSE & IB past papers' })).toBeInTheDocument();
    const maths = screen.getByRole('region', { name: 'Mathematics' });
    expect(within(maths).getByRole('link', { name: /IGCSE Maths 0580\s*216 papers/ })).toHaveAttribute('href', '/past-papers/igcse-maths-0580');
    expect(within(maths).getByRole('link', { name: /IB Math AA HL/ })).toHaveAttribute('href', '/past-papers/ib-math-aa-hl');
    expect(screen.getByRole('region', { name: 'Chemistry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'IGCSE' })).toHaveAttribute('href', '/past-papers/igcse');
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('combobox', { name: 'Find a paper' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Questions and answers together' })).toBeInTheDocument();
    expect(screen.queryByText(/Paper and scheme together/)).not.toBeInTheDocument();
    expect(ldTypes(container)).toEqual(['BreadcrumbList', 'CollectionPage']);
  });

  it('shows one qualification on its own page', () => {
    render(<PastPaperHub banks={hubBanks.filter(b => b.qualification === 'igcse')} qualification="igcse" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Cambridge IGCSE past papers' })).toBeInTheDocument();
    expect(screen.queryByText('IB Math AA HL')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'IGCSE' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('PastPaperListPage', () => {
  it('renders a subject page that answers the query, links years and papers, and has an FAQ', () => {
    const { container } = render(<PastPaperListPage view={{ kind: 'subject', bank, papers: IGCSE_PAPERS, practice: true }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'IGCSE Maths 0580 past papers' })).toBeInTheDocument();
    expect(screen.getByText('5 Cambridge IGCSE Mathematics (0580) past papers from 2024 to 2026, each with its mark scheme. Free, no sign-up.')).toBeInTheDocument();
    const years = screen.getByRole('navigation', { name: 'Browse by year' });
    expect(within(years).getByRole('link', { name: '2025' })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/2025');
    expect(within(screen.getByRole('navigation', { name: 'Browse by paper' })).getByRole('link', { name: /Paper 4/ })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/paper-4');
    expect(screen.getByText('Which 0580 papers do Core and Extended students take?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Practise IGCSE Maths 0580 questions by topic/ })).toHaveAttribute('href', '/banks/igcse');
    expect(ldTypes(container)).toEqual(['BreadcrumbList', 'CollectionPage', 'FAQPage']);
  });

  it('renders a year page with neighbouring years and no FAQ', () => {
    render(<PastPaperListPage view={{ kind: 'year', bank, year: 2025, papers: IGCSE_PAPERS.filter(p => p.year === 2025), all: IGCSE_PAPERS, practice: true }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'IGCSE Maths 0580 past papers 2025' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Previous year: 2024/ })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/2024');
    expect(screen.getByRole('link', { name: /Next year: 2026/ })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/2026');
    expect(screen.queryByText(/Core and Extended students/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/past-papers/igcse-maths-0580/2026-'))).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'IGCSE Maths 0580' })).toHaveAttribute('href', '/past-papers/igcse-maths-0580');
  });

  it('renders a paper-number page with only that paper', () => {
    render(<PastPaperListPage view={{ kind: 'paperNumber', bank, paper: '4', papers: IGCSE_PAPERS.filter(p => p.paper === '4'), all: IGCSE_PAPERS, practice: true }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'IGCSE Maths 0580 Paper 4 past papers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '41' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '21' })).not.toBeInTheDocument();
  });
  it('leaves out the practice link when the bank has no question-bank page yet', () => {
    render(<PastPaperListPage view={{ kind: 'subject', bank, papers: IGCSE_PAPERS, practice: false }} />);
    expect(screen.queryByRole('link', { name: /questions by topic/ })).not.toBeInTheDocument();
  });
});
