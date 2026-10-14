import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { WholePaperManifest } from '@/lib/whole-paper-types';

type Hold = { bankSlug: string; paperId: string; questionSha256: string; markschemeSha256: string; reason: string };
const holds = (JSON.parse(readFileSync('data/paper-archives/report-holds.json', 'utf8')) as { holds: Hold[] }).holds;
const manifest = (slug: string) => JSON.parse(readFileSync(`src/data/paper-archives/${slug}.json`, 'utf8')) as WholePaperManifest;

describe('reviewed whole-paper report holds', () => {
  test('Biology 0610 May/June 2026 Paper 43 stays report-held for its withdrawn Q5(a); the other 17 May/June 2026 reports stay enabled', () => {
    const bio = manifest('igcse-biology-0610');
    const mj26 = bio.papers.filter((p) => p.summary.year === 2026 && p.summary.sessionCode === 's');
    expect(mj26).toHaveLength(18);
    const p43 = mj26.find((p) => p.summary.id === '0610-2026-s-43')!;
    expect(p43.summary).toMatchObject({
      reportAvailable: false,
      reportReason: 'The mark scheme withdrew Q5(a); held until a scoring policy for withdrawn parts is agreed.',
      maxMarks: 80, questionCount: 6, metadataVerified: true,
    });
    expect(p43.questions).toEqual([]);
    // PDFs stay readable and unchanged.
    expect(p43.documents.markscheme.sha256).toBe('1de225168c474127e70861b9f85defab462e651ffe0c88c380adc842b9492ddd');
    const others = mj26.filter((p) => p !== p43);
    expect(others).toHaveLength(17);
    for (const p of others) {
      expect(p.summary.reportAvailable, p.summary.id).toBe(true);
      expect(p.questions.length, p.summary.id).toBe(p.summary.questionCount);
    }
    expect(bio.coverage).toMatchObject({ paired: 316, reports: 311, held: 5 });
  });

  test('every reviewed hold is reflected, bound to both PDFs, in the committed manifest the builder wrote', () => {
    expect(holds.length).toBeGreaterThan(0);
    for (const hold of holds) {
      const entry = manifest(hold.bankSlug).papers.find((p) => p.summary.id === hold.paperId);
      expect(entry, hold.paperId).toBeDefined();
      expect(entry!.documents.question.sha256).toBe(hold.questionSha256);
      expect(entry!.documents.markscheme.sha256).toBe(hold.markschemeSha256);
      expect(entry!.summary.reportAvailable).toBe(false);
      expect(entry!.summary.reportReason).toBe(hold.reason);
      expect(entry!.questions).toEqual([]);
    }
  });
});
