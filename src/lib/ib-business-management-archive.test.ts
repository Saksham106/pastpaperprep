import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { archivePaperKey, questionPaperKey } from './paper-question-links';
import { approvedPapers, objectDownloadNames } from './whole-paper-public';
import type { WholePaperManifest } from './whole-paper-types';

const load = (level: 'hl' | 'sl') => JSON.parse(readFileSync(join(process.cwd(), `src/data/paper-archives/ib-business-management-${level}.json`), 'utf8')) as WholePaperManifest;
const runtime = (level: 'hl' | 'sl') => JSON.parse(readFileSync(join(process.cwd(), `src/data/production/ib-business-management-${level}.json`), 'utf8')) as { questions: { id: string; marks: number }[] };
const hl = load('hl'), sl = load('sl');

describe('IB Business Management whole papers', () => {
  it('lists every paired paper from Nov 2020 to May 2026 except old-guide Paper 1', () => {
    expect(hl.coverage).toEqual({ paired: 40, reports: 7, held: 33, unpaired: 0, runtimeWithoutPair: 9 });
    expect(sl.coverage).toEqual({ paired: 32, reports: 0, held: 32, unpaired: 1, runtimeWithoutPair: 9 });
    for (const m of [hl, sl]) {
      const years = m.papers.map(p => p.summary.year);
      expect(Math.min(...years)).toBe(2020);
      expect(Math.max(...years)).toBe(2026);
      // Old Paper 1 needs the pre-seen case booklet, which the archive cannot list.
      expect(m.papers.filter(p => p.summary.component === 'P1' && p.summary.year < 2024)).toEqual([]);
    }
  });

  it('leaves out Nov 2025 Paper 2 SL TZ1, which has no question paper', () => {
    expect(sl.papers.some(p => p.summary.id === 'business-management-2025-nov-tz1-sl-p2')).toBe(false);
    expect(sl.papers.some(p => p.summary.id === 'business-management-2025-nov-tz3-sl-p2')).toBe(true);
  });

  it('shares each joint Paper 1 PDF between HL and SL under a level-neutral name', () => {
    const joint = (m: WholePaperManifest) => m.papers.filter(p => p.summary.id.includes('-hlsl-p1'));
    expect(joint(hl).map(p => p.documents)).toEqual(joint(sl).map(p => p.documents));
    expect(joint(hl)).toHaveLength(12);
    const names = objectDownloadNames(approvedPapers([hl, sl]));
    for (const p of joint(hl)) expect(names.get(p.documents.question.sha256)).toMatch(/^ib-business-management-20\d\d-[a-z]+-paper-1-tz\d_qp\.pdf$/);
  });

  it('marks only Paper 3 online, with exactly the runtime marks, and holds optional-choice papers', () => {
    const marks = new Map(runtime('hl').questions.map(q => [q.id, q.marks]));
    const reports = hl.papers.filter(p => p.summary.reportAvailable);
    expect(reports.map(p => p.summary.component)).toEqual(Array(7).fill('P3'));
    for (const p of reports) {
      expect(p.questions.reduce((sum, q) => sum + q.maxMarks, 0)).toBe(25);
      for (const q of p.questions) expect(q.maxMarks).toBe(marks.get(q.id));
    }
    for (const p of [...hl.papers, ...sl.papers].filter(p => !p.summary.reportAvailable)) expect(p.summary.reportReason).toBe('Optional question choices need review.');
  });

  it('takes the shortened 2021-2022 Paper 2 timing from the IB adaptations', () => {
    const p2 = (m: WholePaperManifest, year: number) => m.papers.find(p => p.summary.year === year && p.summary.component === 'P2')!.summary;
    expect([p2(hl, 2020), p2(hl, 2021), p2(hl, 2023)].map(s => [s.durationMinutes, s.maxMarks])).toEqual([[135, 70], [105, 50], [135, 70]]);
    expect([p2(sl, 2020), p2(sl, 2022), p2(sl, 2023)].map(s => [s.durationMinutes, s.maxMarks])).toEqual([[105, 50], [75, 30], [105, 50]]);
  });

  it('links every archived paper to its bank questions', () => {
    for (const [m, level] of [[hl, 'hl'], [sl, 'sl']] as const) {
      const keys = new Set(runtime(level).questions.map(q => questionPaperKey(q.id)));
      for (const p of m.papers) expect(keys.has(archivePaperKey(m.bankSlug, p.summary.id)), p.summary.id).toBe(true);
    }
  });
});
