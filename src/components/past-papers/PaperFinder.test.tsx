import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaperFinder } from './PaperFinder';
import { IGCSE_PAPERS } from './fixtures';

const router = vi.hoisted(() => ({ push: vi.fn() }));
const analytics = vi.hoisted(() => ({ trackProductEvent: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/product-analytics', () => analytics);
const subjects = [{ name: 'IGCSE Maths 0580', code: '0580', href: '/past-papers/igcse-maths-0580' }, { name: 'IGCSE Chemistry 0620', code: '0620', href: '/past-papers/igcse-chemistry-0620' }];
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, '', '/'); });
afterEach(() => cleanup());

describe('PaperFinder on a subject page', () => {
  it('suggests the exact paper for a Cambridge code and opens it on Enter', async () => {
    render(<PaperFinder mode="papers" papers={IGCSE_PAPERS} />);
    const box = screen.getByRole('combobox', { name: 'Find a paper' });
    await userEvent.type(box, '0580/42/M/J/24');
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Paper 42 · May/June 2024');
    await userEvent.keyboard('{Enter}');
    expect(router.push).toHaveBeenCalledWith('/past-papers/igcse-maths-0580/2024-may-june-42');
    expect(analytics.trackProductEvent).toHaveBeenCalledWith('past_paper_search', { found: true });
  });

  it('moves through suggestions with the arrow keys', async () => {
    render(<PaperFinder mode="papers" papers={IGCSE_PAPERS} />);
    const box = screen.getByRole('combobox');
    await userEvent.type(box, '2026');
    const [first, second] = screen.getAllByRole('option');
    expect(box).toHaveAttribute('aria-activedescendant', first.id);
    await userEvent.keyboard('{ArrowDown}');
    expect(box).toHaveAttribute('aria-activedescendant', second.id);
  });

  it('says so when nothing matches', async () => {
    render(<PaperFinder mode="papers" papers={IGCSE_PAPERS} />);
    await userEvent.type(screen.getByRole('combobox'), 'banana');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No paper matches. Try 0580/42/M/J/24.')).toBeInTheDocument();
  });

  it('prefills from ?q= so the hub can hand a code over', async () => {
    window.history.replaceState(null, '', '/past-papers/igcse-maths-0580?q=s24%2042');
    render(<PaperFinder mode="papers" papers={IGCSE_PAPERS} />);
    expect(await screen.findByRole('option', { name: /Paper 42 · May\/June 2024/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('s24 42');
  });
});

describe('PaperFinder on the hub', () => {
  it('finds subjects by name', async () => {
    render(<PaperFinder mode="subjects" subjects={subjects} />);
    await userEvent.type(screen.getByRole('combobox'), 'chem');
    expect(screen.getByRole('option', { name: /IGCSE Chemistry 0620/ })).toHaveAttribute('href', '/past-papers/igcse-chemistry-0620');
  });

  it('hands a full paper code to the subject page', async () => {
    render(<PaperFinder mode="subjects" subjects={subjects} />);
    await userEvent.type(screen.getByRole('combobox'), '0580/42/M/J/24');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('href', '/past-papers/igcse-maths-0580?q=0580%2F42%2FM%2FJ%2F24');
  });
});
