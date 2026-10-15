import type { BankSlug } from "@/lib/catalog";
import { getMathsPickerGroups, getMathsPickerTopics, isCleanMathsBank, mathsPickerLabel } from "@/lib/maths-picker";
import { formatPublicLabel } from "@/lib/presentation";
import { filterQuestions } from "@/lib/question-filter";
import type { PublicQuestionMetadata } from "@/lib/question-index";
import type { UnifiedQuestion } from "@/lib/questions";
import { getControlledSubtopics, getTopicOptions } from "@/lib/taxonomy-router";

export type BuilderQuestion = PublicQuestionMetadata & { bankSlug: BankSlug };
export type TopicNode = { key: string; label: string; subtopics: { key: string; label: string }[] };
/** Which topic-tree nodes each question belongs to, worked out once per bank so counts stay instant. */
export type TopicIndex = { tree: TopicNode[]; keysById: ReadonlyMap<string, readonly string[]> };

const SEPARATOR = "␟";
export const topicKey = (topic: string) => `t:${topic}`;
export const subtopicKey = (topic: string, subtopic: string) => `s:${topic}${SEPARATOR}${subtopic}`;
const topicOfKey = (key: string) => key.startsWith("t:") ? key.slice(2) : key.slice(2).split(SEPARATOR)[0];

// The bank page's filter only reads the fields a topic/subtopic filter needs.
const asFilterable = (question: BuilderQuestion) => ({
  ...question, skills: question.skills ?? [], secondarySubtopics: [], courseEra: "", searchText: "",
}) as unknown as UnifiedQuestion;

/** The bank page's own topics and subtopics, so both pages agree on what a topic contains. */
export function buildTopicIndex(questions: readonly BuilderQuestion[], bank: BankSlug): TopicIndex {
  const filterable = questions.map(asFilterable);
  const maths = isCleanMathsBank(bank);
  const topics = maths ? getMathsPickerTopics(filterable) : getTopicOptions(filterable);
  const keysById = new Map<string, string[]>();
  const add = (key: string, matching: readonly UnifiedQuestion[]) => {
    for (const question of matching) {
      const keys = keysById.get(question.id);
      if (keys) keys.push(key); else keysById.set(question.id, [key]);
    }
  };
  const tree: TopicNode[] = [];
  for (const topic of topics) {
    const topicMatches = filterQuestions(filterable, { topics: [topic] });
    if (!topicMatches.length) continue;
    add(topicKey(topic), topicMatches);
    const values = maths ? getMathsPickerGroups(filterable, [topic], []).relevant : [...getControlledSubtopics(bank, topic)];
    const subtopics: TopicNode["subtopics"] = [];
    for (const value of new Set(values)) {
      const matching = filterQuestions(filterable, { subtopics: [value] });
      if (!matching.length) continue;
      const key = subtopicKey(topic, value);
      add(key, matching);
      subtopics.push({ key, label: maths ? mathsPickerLabel(bank, value) : value });
    }
    tree.push({ key: topicKey(topic), label: formatPublicLabel(topic), subtopics });
  }
  return { tree, keysById };
}

/** An empty selection means every topic; otherwise a question needs any selected topic or subtopic. */
export function selectionMatcher(index: TopicIndex, selection: ReadonlySet<string>): (id: string) => boolean {
  if (!selection.size) return () => true;
  return (id) => Boolean(index.keysById.get(id)?.some((key) => selection.has(key)));
}

export function countNodes(index: TopicIndex, ids: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) for (const key of index.keysById.get(id) ?? []) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/** A whole topic and some of its subtopics never coexist: picking one clears the other. */
export function toggleKey(tree: readonly TopicNode[], selection: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(selection);
  if (next.has(key)) { next.delete(key); return next; }
  const topic = topicOfKey(key);
  const node = tree.find((item) => item.key === topicKey(topic));
  if (key.startsWith("t:")) node?.subtopics.forEach((subtopic) => next.delete(subtopic.key));
  else next.delete(topicKey(topic));
  next.add(key);
  return next;
}

/** Keys that name nodes in this tree; anything else (an old link, another bank) is dropped. */
export function knownKeys(tree: readonly TopicNode[], keys: readonly string[]): Set<string> {
  const valid = new Set(tree.flatMap((node) => [node.key, ...node.subtopics.map((subtopic) => subtopic.key)]));
  return new Set(keys.filter((key) => valid.has(key)));
}
