import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_PAPER_READER_CONFIG } from '@/lib/paper-reader-config';
import { PaperWorkspace } from './PaperWorkspace';

const analytics = vi.hoisted(() => ({ trackProductEvent: vi.fn() }));
vi.mock('@/lib/product-analytics', () => analytics);
vi.mock('@/components/PastPaperReader', () => ({ PastPaperReader: ({ kind }: { kind: string }) => <div data-testid="reader">{kind}</div> }));
vi.mock('@/components/PaperMarkingWorkspace', () => ({ PaperMarkingWorkspace: ({ onClose }: { onClose: () => void }) => <div data-testid="marking"><button onClick={onClose}>Back to paper</button></div> }));
const marking = { id: '0580-2024-june-42', version: 'v1', bankSlug: 'igcse', title: 'Paper 42', maxMarks: 4, questions: [{ id: 'q1', number: 1, maxMarks: 4, topics: ['Algebra'] }] };
beforeEach(() => analytics.trackProductEvent.mockClear());
afterEach(() => cleanup());

describe('PaperWorkspace', () => {
  it('reports the open once and keeps the rail beside the paper', () => {
    render(<PaperWorkspace reader={DEFAULT_PAPER_READER_CONFIG} marking={marking} bank="igcse"><p>Other variants</p></PaperWorkspace>);
    expect(analytics.trackProductEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackProductEvent).toHaveBeenCalledWith('past_paper_open', { bank: 'igcse', paper: '0620-2023-w-42' });
    expect(screen.getByTestId('reader')).toHaveTextContent('question');
    expect(screen.getByText('Other variants')).toBeInTheDocument();
  });

  it('swaps the rail for marking and shows the mark scheme', async () => {
    render(<PaperWorkspace reader={DEFAULT_PAPER_READER_CONFIG} marking={marking} bank="igcse"><p>Other variants</p></PaperWorkspace>);
    await userEvent.click(screen.getByRole('button', { name: 'Mark this paper' }));
    expect(screen.getByTestId('marking')).toBeInTheDocument();
    expect(screen.getByTestId('reader')).toHaveTextContent('markscheme');
    expect(screen.queryByText('Other variants')).not.toBeInTheDocument();
    expect(analytics.trackProductEvent).toHaveBeenCalledWith('past_paper_mark_open', { bank: 'igcse' });
    await userEvent.click(screen.getByRole('button', { name: 'Back to paper' }));
    expect(screen.queryByTestId('marking')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark this paper' })).toHaveFocus();
  });

  it('switches documents from the phone dock', async () => {
    render(<PaperWorkspace reader={DEFAULT_PAPER_READER_CONFIG} marking={marking} bank="igcse"><p /></PaperWorkspace>);
    const dock = screen.getByRole('navigation', { name: 'Paper shortcuts' });
    await userEvent.click(screen.getByRole('button', { name: 'Scheme' }));
    expect(screen.getByTestId('reader')).toHaveTextContent('markscheme');
    expect(dock).toContainElement(screen.getByRole('button', { name: 'Mark it' }));
  });

  it('says plainly when a paper cannot be self-marked', () => {
    render(<PaperWorkspace reader={DEFAULT_PAPER_READER_CONFIG} marking={null} bank="igcse"><p /></PaperWorkspace>);
    expect(screen.getByText("Self-marking isn't available for this paper yet.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark/ })).not.toBeInTheDocument();
  });
});
