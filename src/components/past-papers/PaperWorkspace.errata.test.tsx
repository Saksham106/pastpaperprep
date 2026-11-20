import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaperWorkspace } from './PaperWorkspace';
import { DEFAULT_PAPER_READER_CONFIG } from '@/lib/paper-reader-config';
import { withKeyErrata } from '@/lib/mcq-key-errata';
import type { WholePaperManifest } from '@/lib/whole-paper-types';

vi.mock('@/lib/product-analytics', () => ({ trackProductEvent: vi.fn() }));
vi.mock('@/components/PastPaperReader', () => ({ PastPaperReader: ({ kind }: { kind: string }) => <div data-testid="reader">{kind}</div> }));

const manifest = JSON.parse(readFileSync('src/data/paper-archives/a-level-economics-9708.json', 'utf8')) as WholePaperManifest;
const p = manifest.papers.find(entry => entry.summary.id === '9708-2020-w-12')!;
const marking = { id: p.summary.id, version: p.version, bankSlug: 'a-level-economics-9708', title: 'A Level Economics 9708/12 Oct/Nov 2020', maxMarks: p.summary.maxMarks!, questions: withKeyErrata('a-level-economics-9708', p.summary.id, p.documents.markscheme.sha256, p.questions) };
const NOTE = "Cambridge's published scheme says B; the examiner report corrects it to C.";

describe('a reviewed key erratum in the whole-paper marking flow', () => {
  beforeEach(() => localStorage.clear());
  it('stays hidden during the attempt, shows at Q25 when marking, and the report scores 30/30 with the erratum and its source', () => {
    render(<PaperWorkspace reader={DEFAULT_PAPER_READER_CONFIG} marking={marking} bank="a-level-economics-9708"><p>Other variants</p></PaperWorkspace>);
    expect(screen.queryByText(/published scheme says/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark against/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark this paper' }));
    const note = screen.getByText(/Mark against C\./).closest('p')!;
    expect(note).toHaveTextContent(NOTE);
    expect(note).toHaveTextContent('Source: Cambridge Principal Examiner Report, November 2020, 9708/12 key table, p. 3.');
    expect(screen.getByLabelText('Question 25 marks').getAttribute('aria-describedby')).toContain(note.id);
    expect(screen.getAllByText(/Mark against/)).toHaveLength(1);

    for (const q of marking.questions) fireEvent.change(screen.getByLabelText(`Question ${q.number} marks`), { target: { value: String(q.maxMarks) } });
    fireEvent.click(screen.getByText('See where your marks went'));
    expect(screen.getByText('30 / 30 paper marks')).toBeInTheDocument();
    expect(screen.getByText('No revision priorities from the marked questions.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Topics to review' })).not.toBeInTheDocument();
    expect(screen.getByText('Mark scheme correction')).toBeInTheDocument();
    expect(screen.getByText(/published scheme says B/).closest('li')).toHaveTextContent(`Q25 ${NOTE} Source:`);
  });
});
