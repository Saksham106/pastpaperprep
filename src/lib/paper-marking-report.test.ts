import { describe, expect, it } from 'vitest';
import { parseExplorerState } from './explorer-state';
import { PAPER_MARKING_PREVIEW as paper } from './paper-marking-preview';
import { createPaperMarkingReport, topicPracticeHref } from './paper-marking-report';

describe('whole-question marking', () => {
  it.each([NaN, Infinity, -1, 1.5, 9])('rejects invalid question marks %s', score => {
    expect(() => createPaperMarkingReport(paper, { [paper.questions[0].id]: score })).toThrow();
  });
  it('rejects unknown question IDs', () => {
    expect(() => createPaperMarkingReport(paper, { unknown: null })).toThrow();
  });
  it('rejects duplicate IDs, invalid maxima and mismatched totals', () => {
    expect(() => createPaperMarkingReport({ maxMarks: 16, questions: [paper.questions[0], paper.questions[0]] }, {})).toThrow();
    for (const maxMarks of [0, -1, 1.5, NaN, Infinity]) {
      expect(() => createPaperMarkingReport({ maxMarks, questions: [{ ...paper.questions[0], maxMarks }] }, {})).toThrow();
    }
    expect(() => createPaperMarkingReport({ ...paper, maxMarks: 79 }, {})).toThrow();
  });
  it('ranks net loss evidence, repeated loss, then normalized question loss stably', () => {
    const fixture = { maxMarks: 40, questions: [
      { id: 'a', number: 1, maxMarks: 10, topics: ['isolated', 'isolated', 'mixed', 'tie-low'] },
      { id: 'b', number: 2, maxMarks: 10, topics: ['repeated', 'mixed', 'tie-high'] },
      { id: 'c', number: 3, maxMarks: 10, topics: ['repeated', 'tie-high'] },
      { id: 'd', number: 4, maxMarks: 10, topics: ['mixed', 'unlost'] },
    ] };
    const report = createPaperMarkingReport(fixture, { a: 8, b: 0, c: 0, d: 10 });
    expect(report.priorities.map(t => t.topic)).toEqual(['repeated', 'tie-high', 'mixed', 'isolated', 'tie-low']);
    expect(report.priorities.find(t => t.topic === 'mixed')).toMatchObject({ exposureCount: 3, fullMarkEvidence: [{ questionId: 'd', number: 4, earned: 10, maxMarks: 10 }] });
    expect(report.priorities.find(t => t.topic === 'isolated')?.exposureCount).toBe(1);
    expect(report.priorities.some(t => t.topic === 'unlost')).toBe(false);
  });
  it('uses normalized question loss only as the final tie breaker', () => {
    const fixture = { maxMarks: 30, questions: [
      { id: 'a', number: 1, maxMarks: 20, topics: ['larger raw loss'] },
      { id: 'b', number: 2, maxMarks: 10, topics: ['larger relative loss'] },
    ] };
    const report = createPaperMarkingReport(fixture, { a: 10, b: 4 });
    expect(report.priorities.map(t => t.topic)).toEqual(['larger relative loss', 'larger raw loss']);
  });
  it('excludes topic labels from unmarked questions and does not count null as zero', () => {
    const report = createPaperMarkingReport(paper, { [paper.questions[0].id]: 4, [paper.questions[5].id]: null });
    expect(report.priorities.map(t => t.topic)).toEqual(['Atoms, elements and compounds', 'The Periodic Table']);
    expect(report).toMatchObject({ markedTotal: 4, markedMaximum: 8, unmarkedCount: 5 });
    expect(report.successfulTopics).toEqual([]);
  });
  it('returns complete totals and successful evidence without priorities for all full marks', () => {
    const report = createPaperMarkingReport(paper, Object.fromEntries(paper.questions.map(q => [q.id, q.maxMarks])));
    expect(report).toMatchObject({ markedTotal: 80, markedMaximum: 80, complete: true, unmarkedCount: 0, overallScore: { earned: 80, maxMarks: 80 }, priorities: [] });
    expect(report.successfulTopics.length).toBeGreaterThan(0);
    const zero = createPaperMarkingReport(paper, Object.fromEntries(paper.questions.map(q => [q.id, 0])));
    expect(zero.overallScore).toEqual({ earned: 0, maxMarks: 80 });
    expect(zero.priorities).toHaveLength(11);
    expect(zero.successfulTopics).toEqual([]);
  });
  it('links the exact topic and free preview using explorer state', () => {
    const topic = 'Experimental techniques and chemical analysis';
    expect(topicPracticeHref(topic)).toMatch(/^\/banks\/igcse-chemistry-0620\?/);
    const url = new URL(topicPracticeHref(topic), 'https://pastpaperprep.com');
    expect(url.pathname).toBe('/banks/igcse-chemistry-0620');
    expect(url.searchParams.getAll('topic')).toEqual([topic]);
    expect(url.searchParams.get('free')).toBe('1');
    expect(parseExplorerState(Object.fromEntries(url.searchParams))).toMatchObject({ filters: { topics: [topic] }, freeOnly: true });
  });
  it('keeps blanks unmarked and counts an explicit zero once', () => {
    const blank = createPaperMarkingReport(paper, {});
    expect(blank).toMatchObject({ markedTotal: 0, markedMaximum: 0, unmarkedCount: 6, complete: false, overallScore: null, priorities: [] });
    const partial = createPaperMarkingReport(paper, { [paper.questions[0].id]: 0 });
    expect(partial).toMatchObject({ markedTotal: 0, markedMaximum: 8, unmarkedCount: 5, complete: false, overallScore: null });
    expect(partial.priorities[0].lostEvidence[0]).toEqual({ questionId: paper.questions[0].id, number: 1, earned: 0, maxMarks: 8 });
  });
});
