import { paperHref } from './past-paper-catalog';
import type { WholePaperDetail, WholePaperSummary } from './whole-paper-types';

/** Links between bank questions and the full papers they came from.
 * A bank question id is its paper's key plus "-q<number>"; full-paper ids use the same key with a
 * subject prefix and language suffix, so both sides resolve to one key without a mapping table. */
export type PaperQuestion = { id: string; number: number; marks: number | null; topics: readonly string[]; page?: number };

export const questionPaperKey = (questionId: string) => questionId.replace(/-q\d+[a-z]*$/i, '');

export function archivePaperKey(bankSlug: string, paperId: string): string {
  const key = paperId.replace(/-english$/, '').replace(/^(biology|chemistry|physics|economics|computer-science)-/, '');
  if (!bankSlug.startsWith('ib-computer-science')) return key;
  // IB Computer Science bank ids order the parts differently: ib-cs-<year>-<session>-<level>-<paper>-<tz>.
  const match = /^(\d{4})-([a-z]+)-(tz\d)-(hl|sl)-(p\d)$/.exec(key);
  return match ? `ib-cs-${match[1]}-${match[2]}-${match[4]}-${match[5]}-${match[3]}` : key;
}

/** Paper key -> full-paper page, for the "Full paper" link on question cards. */
export function fullPaperHrefs(papers: readonly WholePaperSummary[]): Record<string, string> {
  return Object.fromEntries(papers.map(p => [archivePaperKey(p.bankSlug, p.id), paperHref(p)]));
}

export function fullPaperQuestionHref(hrefs: Readonly<Record<string, string>> | undefined, questionId: string, number: number): string | undefined {
  const href = hrefs?.[questionPaperKey(questionId)];
  return href ? `${href}#q${number}` : undefined;
}

/** Question number -> page in the question paper, for jumping straight to a question. */
export function questionPages(questions: readonly PaperQuestion[]): Record<number, number> {
  return Object.fromEntries(questions.filter(q => q.page).map(q => [q.number, q.page!]));
}

/** The archive's own question list (papers that passed the self-marking checks). */
export function archiveQuestions(detail: Pick<WholePaperDetail, 'questions'>): PaperQuestion[] {
  return detail.questions.map(q => ({ id: q.id, number: q.number, marks: q.maxMarks, topics: q.topics, ...(q.questionPage ? { page: q.questionPage } : {}) }));
}

export type PaperTopic = { topic: string; numbers: number[] };
/** Each topic in the paper with the questions that test it, most-tested first (ties keep paper order). */
export function paperTopicSummary(questions: readonly PaperQuestion[]): PaperTopic[] {
  const byTopic = new Map<string, number[]>();
  for (const q of [...questions].sort((a, b) => a.number - b.number)) for (const topic of q.topics) {
    const numbers = byTopic.get(topic) ?? [];
    if (!numbers.includes(q.number)) numbers.push(q.number);
    byTopic.set(topic, numbers);
  }
  return [...byTopic].map(([topic, numbers]) => ({ topic, numbers })).sort((a, b) => b.numbers.length - a.numbers.length);
}
