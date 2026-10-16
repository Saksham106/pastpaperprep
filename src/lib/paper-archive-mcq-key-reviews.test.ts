import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { WholePaperManifest } from '@/lib/whole-paper-types';

type Review = { bankSlug: string; paperId: string; questionSha256: string; markschemeSha256: string; keys: Record<string, string> };
const reviews = (JSON.parse(readFileSync('data/paper-archives/mcq-key-reviews.json', 'utf8')) as { reviews: Review[] }).reviews;
const manifest = (slug: string) => JSON.parse(readFileSync(`src/data/paper-archives/${slug}.json`, 'utf8')) as WholePaperManifest;
const letters = JSON.parse(readFileSync('src/data/reviewed-mcq-answer-letters.json', 'utf8')) as { banks: Record<string, Record<string, { answers: string[] }>> };

const TZ3 = [
  { slug: 'ib-physics-hl', id: 'physics-2026-may-tz3-hl-p1a-english', runtimePaper: '2026-may-tz3-hl-p1a', questions: 40, key: '39' },
  { slug: 'ib-physics-sl', id: 'physics-2026-may-tz3-sl-p1a-english', runtimePaper: '2026-may-tz3-sl-p1a', questions: 25, key: '24' },
];

describe('IB Physics May 2026 TZ3 Paper 1A self-mark reports', () => {
  test.each(TZ3)('$id is report-available with one mark per question and the printed total', ({ slug, id, questions }) => {
    const entry = manifest(slug).papers.find((p) => p.summary.id === id)!;
    expect(entry.summary).toMatchObject({ reportAvailable: true, maxMarks: questions, questionCount: questions, metadataVerified: true });
    expect(entry.summary.reportReason).toBeUndefined();
    expect(entry.questions).toHaveLength(questions);
    expect(entry.questions.every((q) => q.maxMarks === 1)).toBe(true);
    expect(entry.questions.reduce((sum, q) => sum + q.maxMarks, 0)).toBe(entry.summary.maxMarks);
  });

  test('exactly these two papers carry a reviewed key, bound to both PDFs and equal to the reviewed runtime letter', () => {
    expect(reviews.map((r) => r.paperId).sort()).toEqual(TZ3.map((t) => t.id).sort());
    for (const t of TZ3) {
      const review = reviews.find((r) => r.paperId === t.id)!;
      const entry = manifest(t.slug).papers.find((p) => p.summary.id === t.id)!;
      expect(review.bankSlug).toBe(t.slug);
      expect(review.questionSha256).toBe(entry.documents.question.sha256);
      expect(review.markschemeSha256).toBe(entry.documents.markscheme.sha256);
      expect(Object.keys(review.keys)).toEqual([t.key]);
      expect([review.keys[t.key]]).toEqual(letters.banks[t.slug][`${t.runtimePaper}-q${t.key}`].answers);
    }
  });

  test('no other paper changes behaviour: the other eight 2026 papers per level stay report-available', () => {
    for (const slug of ['ib-physics-hl', 'ib-physics-sl']) {
      const m = manifest(slug);
      const others = m.papers.filter((p) => p.summary.year === 2026 && !TZ3.some((t) => t.id === p.summary.id));
      expect(others).toHaveLength(8);
      for (const p of others) expect(p.summary.reportAvailable, p.summary.id).toBe(true);
    }
    expect(manifest('ib-physics-hl').coverage).toMatchObject({ paired: 93, reports: 72, held: 21 });
    expect(manifest('ib-physics-sl').coverage).toMatchObject({ paired: 93, reports: 73, held: 20 });
  });
});
