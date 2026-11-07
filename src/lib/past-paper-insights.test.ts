import { describe, expect, it } from 'vitest';
import { paperIndexing } from './past-paper-indexing';
import { mainTopic, paperThreshold, paperTopicMarks, thresholdSeries, topicFrequency } from './past-paper-insights';
import type { WholePaperSummary } from './whole-paper-types';

const q = (number: number, marks: number | null, ...topics: string[]) => ({ id: `x-q${number}`, number, marks, topics });

describe('paperIndexing', () => {
  it('indexes free papers whose worked answers cover at least 80% of questions', () => {
    expect(paperIndexing({ year: 2019, latestYear: 2026, questionCount: 10, workedAnswers: 8 })).toEqual({ indexed: true, reason: 'worked-answers' });
    expect(paperIndexing({ year: 2019, latestYear: 2026, questionCount: 10, workedAnswers: 7 })).toEqual({ indexed: false, reason: null });
  });
  it('indexes the latest exam year and nothing else without worked answers', () => {
    expect(paperIndexing({ year: 2026, latestYear: 2026, questionCount: 0, workedAnswers: 0 })).toEqual({ indexed: true, reason: 'latest-year' });
    expect(paperIndexing({ year: 2025, latestYear: 2026, questionCount: 40, workedAnswers: 0 }).indexed).toBe(false);
    expect(paperIndexing({ year: 2025, latestYear: 2026, questionCount: 0, workedAnswers: 0 }).indexed).toBe(false);
  });
});

describe('topic weights', () => {
  it('credits each question to its first non-status topic', () => {
    expect(mainTopic(['Earlier syllabus topics', 'Motion, forces and energy'])).toBe('Motion, forces and energy');
    expect(mainTopic(['Questions needing section review'])).toBeNull();
  });
  it('sums marks per main topic so shares add up to the paper', () => {
    const { topics, total } = paperTopicMarks([q(1, 4, 'Hardware'), q(2, 6, 'Software', 'Hardware'), q(3, 5, 'Hardware'), q(4, null, 'Software')]);
    expect(total).toBe(15);
    expect(topics).toEqual([{ topic: 'Hardware', marks: 9, numbers: [1, 3] }, { topic: 'Software', marks: 6, numbers: [2] }]);
  });
  it('counts how many papers test each topic, ignoring papers without a question list', () => {
    const result = topicFrequency([[q(1, 4, 'A'), q(2, 2, 'B')], [q(1, 6, 'A')], []]);
    expect(result.papers).toBe(2);
    expect(result.topics).toEqual([{ topic: 'A', papers: 2, share: 1, averageMarks: 5 }, { topic: 'B', papers: 1, share: 0.5, averageMarks: 2 }]);
  });
});

describe('grade thresholds', () => {
  const paper = (session: string, year: number, component: string) => ({ session, year, component, qualification: 'Cambridge IGCSE' }) as WholePaperSummary;
  it('maps sessions to Cambridge series names', () => {
    expect(thresholdSeries(paper('May/June', 2025, '42'))).toBe('June 2025');
    expect(thresholdSeries(paper('Feb/March', 2026, '42'))).toBe('March 2026');
    expect(thresholdSeries(paper('Oct/Nov', 2024, '41'))).toBe('November 2024');
    expect(thresholdSeries(paper('May', 2025, '1'))).toBeNull();
  });
  it('finds a paper component in the published table', () => {
    const row = paperThreshold('igcse-chemistry-0620', paper('May/June', 2025, '42'));
    expect(row?.series).toBe('June 2025');
    expect(row?.component).toBe('42');
    expect(row?.values).toHaveLength(row!.headings.length);
    expect(paperThreshold('igcse-chemistry-0620', paper('May/June', 2019, '42'))).toBeNull();
  });
});
