import { describe, expect, it } from 'vitest';
import { paperIndexing } from './past-paper-indexing';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { completeInventory, mainTopic, paperThreshold, paperTopicMarks, thresholdSeries, topicFrequency } from './past-paper-insights';
import { subjectSlugForBank } from './past-paper-catalog';
import { getGradeThresholds } from './grade-thresholds';
import type { WholePaperManifest } from './whole-paper-types';

const q = (number: number, marks: number | null, ...topics: string[]) => ({ id: `x-q${number}`, number, marks, topics });

describe('paperIndexing', () => {
  it('indexes free papers whose worked answers cover at least 80% of questions', () => {
    expect(paperIndexing({ year: 2019, latestYear: 2026, questionCount: 10, workedAnswers: 8 })).toEqual({ indexed: true, reason: 'worked-answers' });
    expect(paperIndexing({ year: 2019, latestYear: 2026, questionCount: 10, workedAnswers: 7 })).toEqual({ indexed: false, reason: null });
  });
  it('never qualifies on worked answers when the whole-paper count is unknown', () => {
    expect(paperIndexing({ year: 2019, latestYear: 2026, questionCount: null, workedAnswers: 28 }).indexed).toBe(false);
    expect(paperIndexing({ year: 2019, latestYear: 2026, questionCount: 40, workedAnswers: 28 }).indexed).toBe(false);
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

describe('complete inventories', () => {
  const summary = { questionCount: 3, maxMarks: 10 };
  it('accepts only a list that is the whole paper', () => {
    expect(completeInventory(summary, [q(1, 4, 'A'), q(2, 3, 'B'), q(3, 3, 'C')])).toBe(true);
    expect(completeInventory(summary, [q(1, 4, 'A'), q(2, 3, 'B')])).toBe(false); // partial bank import
    expect(completeInventory({ ...summary, questionCount: 0 }, [q(1, 4, 'A'), q(2, 3, 'B'), q(3, 3, 'C')])).toBe(false); // count unknown
    expect(completeInventory(summary, [q(1, 4, 'A'), q(2, 6, 'B'), q(3, 6, 'C')])).toBe(false); // optional choice: listed marks exceed the paper
    expect(completeInventory(summary, [q(1, 4, 'A'), q(2, null, 'B'), q(3, 6, 'C')])).toBe(false);
  });
});

// Real archive summaries, so session spellings match production ("October/November", not "Oct/Nov").
const archives = readdirSync(join(process.cwd(), 'src/data/paper-archives')).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(process.cwd(), 'src/data/paper-archives', f), 'utf8')) as WholePaperManifest);
const igcsePapers = archives.flatMap(m => m.papers.map(p => p.summary)).filter(p => p.qualification === 'Cambridge IGCSE');

describe('grade thresholds on real archive papers', () => {
  it('maps every IGCSE archive session to a Cambridge series name', () => {
    expect(igcsePapers.length).toBeGreaterThan(1000);
    for (const p of igcsePapers) expect(thresholdSeries(p), `${p.id} ${p.session}`).toMatch(/^(June|March|November) \d{4}$/);
  });
  it('finds 0580/42 October/November 2025 in the November 2025 table', () => {
    const p = igcsePapers.find(s => s.syllabusCode === '0580' && s.year === 2025 && s.session === 'October/November' && s.component === '42');
    const row = p && paperThreshold(subjectSlugForBank(p.bankSlug), p);
    expect(row).toMatchObject({ series: 'November 2025', component: '42' });
    expect(row?.values).toHaveLength(row!.headings.length);
  });
  it('joins every archive paper that has a published component row', () => {
    // Independent of thresholdSeries: Cambridge's own session codes (s = June, m = March, w = November).
    const month: Record<string, string> = { s: 'June', m: 'March', w: 'November' };
    let expected = 0, found = 0;
    for (const p of igcsePapers) {
      const table = getGradeThresholds(subjectSlugForBank(p.bankSlug))?.tables.find(t => t.series === `${month[p.sessionCode]} ${p.year}`);
      if (!table?.components.rows.some(r => r.component === `Component ${p.component}`)) continue;
      expected++;
      if (paperThreshold(subjectSlugForBank(p.bankSlug), p)) found++;
    }
    expect(expected).toBeGreaterThan(280);
    expect(found).toBe(expected);
  });
});
