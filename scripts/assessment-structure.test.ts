import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { assessmentFor, loadAssessmentStructure } from './assessment-structure.mjs';

const DIR = 'src/data/paper-archives';
const structure = loadAssessmentStructure();
type Paper = { summary: { id: string; bankSlug: string; year: number; component: string; route?: string | null; durationMinutes: number | null; maxMarks: number | null; reportAvailable: boolean }; questions: Array<{ maxMarks: number }> };
const papers = readdirSync(DIR).filter((file) => file.endsWith('.json')).flatMap((file) =>
  (JSON.parse(readFileSync(path.join(DIR, file), 'utf8')) as { papers: Paper[] }).papers);

test('every live paper takes its duration and maximum marks from the syllabus table, exactly one entry each', () => {
  expect(papers.length).toBeGreaterThan(2700);
  const wrong = papers.flatMap(({ summary }) => {
    const official = assessmentFor(structure, summary);
    return summary.durationMinutes === official.durationMinutes && summary.maxMarks === official.maxMarks ? [] : [`${summary.id}: ${summary.durationMinutes}/${summary.maxMarks} != ${official.durationMinutes}/${official.maxMarks}`];
  });
  expect(wrong).toEqual([]);
});

test('every marked paper\'s questions add up to its official maximum', () => {
  const mismatched = papers.filter(({ summary, questions }) => summary.reportAvailable && questions.reduce((sum, question) => sum + question.maxMarks, 0) !== summary.maxMarks);
  expect(mismatched.map(({ summary }) => summary.id)).toEqual([]);
});

test('every table entry cites its source, and shared sittings carry no per-paper timer', () => {
  for (const entry of structure.entries as Array<Record<string, unknown>>) {
    expect(entry.durationSource ?? entry.marksSource, `${entry.bank} ${entry.component}`).toBeTruthy();
    expect(entry.marksSource, `${entry.bank} ${entry.component} ${String(entry.years)}`).toBeTruthy();
  }
  const shared = papers.filter(({ summary }) => /^P1[AB]$/.test(summary.component) && summary.year >= 2025);
  expect(shared.length).toBeGreaterThan(0);
  expect(shared.every(({ summary }) => summary.durationMinutes === null)).toBe(true);
});

test('a cover the parser misreads cannot set the timer: Nov 2019 IB CS HL Paper 2 is 80 minutes', () => {
  const paper = papers.find(({ summary }) => summary.id === 'computer-science-2019-nov-tz0-hl-p2')!;
  expect(paper.summary.durationMinutes).toBe(80);
  expect(assessmentFor(structure, paper.summary).durationMinutes).toBe(80);
});
