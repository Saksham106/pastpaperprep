// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import letters from '@/data/reviewed-mcq-answer-letters.json';
import { KEY_ERRATA, erratumMessage, withKeyErrata } from './mcq-key-errata';
import { createPaperMarkingReport } from './paper-marking-report';
import type { WholePaperManifest } from './whole-paper-types';

const DIR = 'src/data/paper-archives';
const manifests = readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as WholePaperManifest);
const paper = (bank: string, id: string) => manifests.find(m => m.bankSlug === bank)!.papers.find(p => p.summary.id === id)!;
const marking = (bank: string, id: string) => {
  const p = paper(bank, id);
  return { maxMarks: p.summary.maxMarks!, questions: withKeyErrata(bank, id, p.documents.markscheme.sha256, p.questions) };
};

describe('reviewed MCQ key corrections apply to whole-paper marking', () => {
  it('every reviewed letter that corrects the official key has an erratum, with the same letter', () => {
    const corrections = Object.entries((letters as unknown as { banks: Record<string, Record<string, { answers: string[]; note?: string }>> }).banks)
      .flatMap(([bank, rows]) => Object.entries(rows).filter(([, row]) => row.note).map(([id, row]) => ({ bank, id, row })));
    expect(corrections.length).toBeGreaterThanOrEqual(6);
    for (const { bank, id, row } of corrections) {
      const erratum = KEY_ERRATA.find(e => e.bankSlug === bank && e.questionId === id);
      expect(erratum, `${bank} ${id}`).toBeDefined();
      expect(erratum!.corrected).toBe(row.answers[0]);
      // The reviewed note names the letter Cambridge printed.
      expect(row.note).toMatch(new RegExp(`prints ${erratum!.published}\\b`));
    }
    expect(KEY_ERRATA).toHaveLength(corrections.length);
  });

  it('every erratum names a self-marked archive paper, its question number and the exact mark-scheme PDF served', () => {
    for (const e of KEY_ERRATA) {
      const p = paper(e.bankSlug, e.paperId);
      expect(p, e.questionId).toBeDefined();
      expect(p.summary.reportAvailable).toBe(true);
      expect(p.documents.markscheme.sha256).toBe(e.markschemeSha256);
      expect(p.questions.find(q => q.id === e.questionId)?.number).toBe(e.number);
    }
  });

  it('applies nothing when the mark-scheme PDF is not the reviewed one', () => {
    const p = paper('a-level-economics-9708', '9708-2020-w-12');
    expect(withKeyErrata('a-level-economics-9708', '9708-2020-w-12', 'f'.repeat(64), p.questions).some(q => 'erratum' in q)).toBe(false);
  });

  it('9708/12 Oct/Nov 2020: Q25 marks against C, and correct answers score 30/30 with no revision topic', () => {
    const m = marking('a-level-economics-9708', '9708-2020-w-12');
    const flagged = m.questions.filter(q => q.erratum);
    expect(flagged.map(q => q.number)).toEqual([25]);
    expect(erratumMessage(flagged[0].erratum!)).toBe("Cambridge's published scheme says B; the examiner report corrects it to C.");
    const report = createPaperMarkingReport(m, Object.fromEntries(m.questions.map(q => [q.id, q.maxMarks])));
    expect(report.complete).toBe(true);
    expect([report.markedTotal, m.maxMarks]).toEqual([30, 30]);
    expect(report.priorities).toEqual([]);
  });

  it('0654/23 Oct/Nov 2020 (shifted key) gets the same treatment: five corrected rows, 40/40 for correct answers', () => {
    const m = marking('igcse-coordinated-sciences-0654', '0654-2020-winter-23');
    expect(m.questions.filter(q => q.erratum).map(q => [q.number, q.erratum!.published, q.erratum!.corrected])).toEqual([[8, 'D', 'B'], [9, 'B', 'D'], [11, 'A', 'B'], [12, 'D', 'A'], [14, 'B', 'D']]);
    const report = createPaperMarkingReport(m, Object.fromEntries(m.questions.map(q => [q.id, q.maxMarks])));
    expect([report.markedTotal, m.maxMarks]).toEqual([40, 40]);
    expect(report.priorities).toEqual([]);
  });
});
