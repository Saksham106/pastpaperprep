import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildPaperMatrix } from '@/lib/past-paper-catalog';
import { PaperMatrix } from './PaperMatrix';
import { PaperLibraryTools } from './PaperLibraryTools';
import { IB_PAPERS, IGCSE_PAPERS } from './fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/product-analytics', () => ({ trackProductEvent: vi.fn() }));
const data = buildPaperMatrix(IGCSE_PAPERS, 'igcse-maths-0580');
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('PaperMatrix', () => {
  it('links every paper with a readable title', () => {
    render(<PaperMatrix data={data} tier="all" />);
    expect(screen.getByRole('link', { name: '21' })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/2026-may-june-21');
    expect(screen.getByRole('link', { name: '42' })).toHaveAttribute('title', 'Paper 42, May/June 2024');
    expect(screen.getAllByRole('link').filter(a => /\/20\d\d-/.test(a.getAttribute('href') ?? ''))).toHaveLength(5);
  });

  it('marks only the latest session as new and links column headers to paper pages', () => {
    render(<PaperMatrix data={data} tier="all" />);
    expect(screen.getAllByText('New')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: /May\/June\s*New/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Paper 4\s*Extended/ })).toHaveAttribute('href', '/past-papers/igcse-maths-0580/paper-4');
  });

  it('ticks papers marked on this device and ignores corrupt or empty marks', async () => {
    localStorage.setItem('pastpaperprep:marks:igcse:0580-2026-june-21:v1', JSON.stringify({ q1: 3, q2: null }));
    localStorage.setItem('pastpaperprep:marks:igcse:0580-2026-june-22:v1', '{broken');
    localStorage.setItem('pastpaperprep:marks:igcse:0580-2025-november-41:v1', JSON.stringify({ q1: null }));
    localStorage.setItem('pastpaperprep:marks:igcse:0580-2024-june-42:v1', JSON.stringify([3]));
    const { container } = render(<PaperMatrix data={data} tier="all" />);
    expect(await screen.findByText(/of 5 marked/)).toHaveTextContent('1 of 5 marked');
    expect(container.querySelectorAll('[data-done]')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /21/ })).toHaveAttribute('data-done');
  });

  it('shows no progress line before anything is marked', () => {
    render(<PaperMatrix data={data} tier="all" />);
    expect(screen.queryByText(/marked/)).not.toBeInTheDocument();
  });
});

describe('PaperLibraryTools', () => {
  it('switches tiers with the toggle beside the search box', async () => {
    const { container } = render(<PaperLibraryTools data={data} papers={IGCSE_PAPERS} />);
    const toggle = screen.getByRole('group', { name: 'Course route' });
    expect(within(toggle).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(toggle).getByRole('button', { name: 'Core' }));
    expect(container.querySelector('[data-tier]')).toHaveAttribute('data-tier', 'core');
    expect(within(toggle).getByRole('button', { name: 'Core' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('has no tier toggle for IB banks', () => {
    render(<PaperLibraryTools data={buildPaperMatrix(IB_PAPERS, 'ib-math-aa-hl')} papers={IB_PAPERS} />);
    expect(screen.queryByRole('group', { name: 'Course route' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TZ1' })).toBeInTheDocument();
  });
});
