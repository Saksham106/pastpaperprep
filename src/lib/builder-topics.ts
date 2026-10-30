import type { BankSlug } from "@/lib/catalog";
import { EARLIER_MATHS_TOPIC, getMathsPickerGroups, getMathsPickerTopics, isCleanMathsBank, isMathsEarlierToken, mathsPickerLabel } from "@/lib/maths-picker";
import { formatPublicLabel } from "@/lib/presentation";
import { filterQuestions, isMainTopic } from "@/lib/question-filter";
import type { PublicQuestionMetadata } from "@/lib/question-index";
import type { UnifiedQuestion } from "@/lib/questions";
import { getControlledSubtopics, getTopicOptions } from "@/lib/taxonomy-router";

export type BuilderQuestion = PublicQuestionMetadata & { bankSlug: BankSlug };
export type TopicNode = { key: string; label: string; subtopics: { key: string; label: string }[] };
/** Which topic-tree nodes each question belongs to, worked out once per bank so counts stay instant. */
export type TopicIndex = {
  tree: TopicNode[];
  /** Every node a question is tagged with, as the bank page filters. */
  keysById: ReadonlyMap<string, readonly string[]>;
  /** Only the nodes under the question's main topic. */
  mainKeysById: ReadonlyMap<string, readonly string[]>;
};
/** "main": the question is mainly on a picked topic. "any": it covers one in at least one part. */
export type TopicScope = "main" | "any";

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
  const mainKeysById = new Map<string, string[]>();
  const add = (key: string, topic: string, matching: readonly UnifiedQuestion[]) => {
    for (const question of matching) {
      for (const map of isMainTopic(question, topic) ? [keysById, mainKeysById] : [keysById]) {
        const keys = map.get(question.id);
        if (keys) keys.push(key); else map.set(question.id, [key]);
      }
    }
  };
  const tree: TopicNode[] = [];
  for (const topic of topics) {
    const topicMatches = filterQuestions(filterable, { topics: [topic] });
    if (!topicMatches.length) continue;
    add(topicKey(topic), topic, topicMatches);
    // Maths: earlier-syllabus aliases sit only under "Earlier syllabus", as on the bank page.
    const values = maths
      ? getMathsPickerGroups(filterable, [topic], []).relevant.filter((value) => isMathsEarlierToken(value) === (topic === EARLIER_MATHS_TOPIC))
      : [...getControlledSubtopics(bank, topic)];
    const subtopics: TopicNode["subtopics"] = [];
    for (const value of new Set(values)) {
      const matching = filterQuestions(filterable, { subtopics: [value] });
      if (!matching.length) continue;
      const key = subtopicKey(topic, value);
      add(key, topic, matching);
      subtopics.push({ key, label: maths ? mathsPickerLabel(bank, value) : value });
    }
    tree.push({ key: topicKey(topic), label: formatPublicLabel(topic), subtopics });
  }
  return { tree, keysById, mainKeysById };
}

const keysFor = (index: TopicIndex, scope: TopicScope) => scope === "main" ? index.mainKeysById : index.keysById;

/** An empty selection means every topic; otherwise a question needs any selected topic or subtopic. */
export function selectionMatcher(index: TopicIndex, selection: ReadonlySet<string>, scope: TopicScope = "main"): (id: string) => boolean {
  if (!selection.size) return () => true;
  const keysById = keysFor(index, scope);
  return (id) => Boolean(keysById.get(id)?.some((key) => selection.has(key)));
}

export function countNodes(index: TopicIndex, ids: Iterable<string>, scope: TopicScope = "main"): Map<string, number> {
  const keysById = keysFor(index, scope);
  const counts = new Map<string, number>();
  for (const id of ids) for (const key of keysById.get(id) ?? []) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/** The picked topics a question covers only in part; empty when it is mainly on one of them. */
export function partlyCovered(index: TopicIndex, selection: ReadonlySet<string>, id: string): string[] {
  if (index.mainKeysById.get(id)?.some((key) => selection.has(key))) return [];
  const keys = new Set(index.keysById.get(id)?.filter((key) => selection.has(key)));
  return index.tree.flatMap((node) => [node, ...node.subtopics]).filter((node) => keys.has(node.key)).map((node) => node.label);
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
