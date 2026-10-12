import { parseExplorerState, serializeExplorerState } from './explorer-state';

/** Review heuristic, not topic accuracy: net lost-question evidence first,
 * repeated losses second, mean normalized whole-question loss third.
 * Exact ties retain first topic appearance in manifest order. Never allocate
 * question lost-mark totals to topic labels. Full marks are counter-evidence. */
export const TOPIC_REVIEW_POLICY = 'net-loss-evidence/repeated-loss/mean-question-loss-v1';

export function topicPracticeHref(topic: string, bankSlug = 'igcse-chemistry-0620'): string {
  const params = serializeExplorerState(parseExplorerState({ topic, free: '1' }));
  return `https://pastpaperprep.com/banks/${encodeURIComponent(bankSlug)}?${params}`;
}

function compareReview(a: TopicReview, b: TopicReview): number {
  const net = (t: TopicReview) => t.lostEvidence.length - t.fullMarkEvidence.length;
  const meanLoss = (t: TopicReview) => t.lostEvidence.reduce((sum, q) => sum + (q.maxMarks - q.earned) / q.maxMarks, 0) / t.lostEvidence.length;
  return net(b) - net(a) || b.lostEvidence.length - a.lostEvidence.length || meanLoss(b) - meanLoss(a);
}

export type MarkingManifest = { maxMarks: number; questions: readonly { id: string; number: number; maxMarks: number; topics: readonly string[] }[] };
export type QuestionMarks = Record<string, number | null>;
export type QuestionEvidence = { questionId: string; number: number; earned: number; maxMarks: number };
export type TopicReview = { topic: string; lostEvidence: QuestionEvidence[]; fullMarkEvidence: QuestionEvidence[]; exposureCount: number };

export function createPaperMarkingReport(paper: MarkingManifest, marks: QuestionMarks) {
  const ids = new Set<string>();
  let maximum = 0;
  if (!Number.isSafeInteger(paper.maxMarks) || paper.maxMarks <= 0) throw new Error('Invalid paper maximum');
  for (const question of paper.questions) {
    if (ids.has(question.id)) throw new Error('Duplicate question ID');
    ids.add(question.id);
    if (!Number.isSafeInteger(question.maxMarks) || question.maxMarks <= 0) throw new Error('Invalid question maximum');
    maximum += question.maxMarks;
  }
  if (maximum !== paper.maxMarks) throw new Error('Question maxima do not match paper maximum');
  for (const [id, earned] of Object.entries(marks)) {
    if (!ids.has(id)) throw new Error('Unknown question ID');
    const question = paper.questions.find(q => q.id === id)!;
    if (earned !== null && (!Number.isSafeInteger(earned) || earned < 0 || earned > question.maxMarks)) throw new Error('Invalid question marks');
  }
  let markedTotal = 0, markedMaximum = 0, unmarkedCount = 0;
  const topics = new Map<string, TopicReview>();
  for (const question of paper.questions) {
    const earned = marks[question.id];
    if (earned == null) { unmarkedCount++; continue; }
    markedTotal += earned;
    markedMaximum += question.maxMarks;
    const evidence = { questionId: question.id, number: question.number, earned, maxMarks: question.maxMarks };
    for (const topic of new Set(question.topics)) {
      const bucket = topics.get(topic) ?? { topic, lostEvidence: [], fullMarkEvidence: [], exposureCount: 0 };
      bucket.exposureCount++;
      (earned < question.maxMarks ? bucket.lostEvidence : bucket.fullMarkEvidence).push(evidence);
      topics.set(topic, bucket);
    }
  }
  const complete = unmarkedCount === 0;
  return { markedTotal, markedMaximum, unmarkedCount, complete, overallScore: complete ? { earned: markedTotal, maxMarks: paper.maxMarks } : null, priorities: [...topics.values()].filter(t => t.lostEvidence.length).sort(compareReview), successfulTopics: [...topics.values()].filter(t => t.fullMarkEvidence.length) };
}
