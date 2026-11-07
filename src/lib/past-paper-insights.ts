import { getGradeThresholds, type ThresholdTable } from './grade-thresholds';
import type { PaperQuestion } from './paper-question-links';
import { STATUS_TOPIC } from './question-filter';
import type { WholePaperSummary } from './whole-paper-types';

/** Facts derived from our own question data and Cambridge's published threshold tables, for the
 * crawlable "at a glance" text on paper pages and the topic table on paper-number pages. */

/** The question's own topic: the first that isn't a status label such as "Earlier syllabus topics". */
export function mainTopic(topics: readonly string[]): string | null {
  return topics.find(topic => !STATUS_TOPIC.test(topic)) ?? null;
}

export type TopicMarks = { topic: string; marks: number; numbers: number[] };
/** Marks per main topic, most marks first. Each question counts once, so the shares add up to the paper. */
export function paperTopicMarks(questions: readonly PaperQuestion[]): { topics: TopicMarks[]; total: number } {
  const byTopic = new Map<string, TopicMarks>();
  let total = 0;
  for (const q of [...questions].sort((a, b) => a.number - b.number)) {
    const topic = mainTopic(q.topics);
    if (!topic || q.marks === null) continue;
    total += q.marks;
    const entry = byTopic.get(topic) ?? { topic, marks: 0, numbers: [] };
    entry.marks += q.marks;
    if (!entry.numbers.includes(q.number)) entry.numbers.push(q.number);
    byTopic.set(topic, entry);
  }
  return { topics: [...byTopic.values()].sort((a, b) => b.marks - a.marks || a.numbers[0] - b.numbers[0]), total };
}

export type TopicFrequency = { topic: string; papers: number; share: number; averageMarks: number };
/** How often each main topic appears across a set of papers (one paper number), and its typical weight. */
export function topicFrequency(papers: readonly (readonly PaperQuestion[])[]): { papers: number; topics: TopicFrequency[] } {
  const counted = papers.filter(questions => questions.length > 0);
  const stats = new Map<string, { papers: number; marks: number }>();
  for (const questions of counted) {
    for (const { topic, marks } of paperTopicMarks(questions).topics) {
      const entry = stats.get(topic) ?? { papers: 0, marks: 0 };
      entry.papers += 1;
      entry.marks += marks;
      stats.set(topic, entry);
    }
  }
  const topics = [...stats].map(([topic, s]) => ({ topic, papers: s.papers, share: s.papers / counted.length, averageMarks: Math.round(s.marks / s.papers) }))
    .sort((a, b) => b.papers - a.papers || b.averageMarks - a.averageMarks || a.topic.localeCompare(b.topic));
  return { papers: counted.length, topics };
}

/** Cambridge names threshold tables by month: May/June papers are "June", Feb/March "March", Oct/Nov "November". */
const SERIES_MONTH: Record<string, string> = { 'May/June': 'June', 'Feb/March': 'March', 'Oct/Nov': 'November' };
export const thresholdSeries = (p: Pick<WholePaperSummary, 'session' | 'year'>) => SERIES_MONTH[p.session] ? `${SERIES_MONTH[p.session]} ${p.year}` : null;

export type ComponentThreshold = { series: string; component: string; maxMark: number; headings: readonly string[]; values: readonly (number | null)[]; sourceUrl: string };
function componentRow(table: ThresholdTable, component: string): ComponentThreshold | null {
  const row = table.components.rows.find(r => r.component === `Component ${component}`);
  return row ? { series: table.series, component, maxMark: row.maxMark, headings: table.components.headings, values: row.values, sourceUrl: table.sourceUrl } : null;
}

/** This paper's own grade thresholds, when Cambridge has published them and we hold that table. */
export function paperThreshold(subjectSlug: string, p: WholePaperSummary): ComponentThreshold | null {
  const series = thresholdSeries(p);
  const table = series ? getGradeThresholds(subjectSlug)?.tables.find(t => t.series === series) : undefined;
  return table ? componentRow(table, p.component) : null;
}

/** Thresholds for every variant of one paper number in the latest series we hold, newest first. */
export function paperNumberThresholds(subjectSlug: string, papers: readonly WholePaperSummary[], seriesLimit = 4): ComponentThreshold[] {
  const tables = getGradeThresholds(subjectSlug)?.tables ?? [];
  const components = [...new Set(papers.map(p => p.component))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return tables.slice(0, seriesLimit).flatMap(table => components.map(c => componentRow(table, c)).filter((row): row is ComponentThreshold => row !== null));
}
