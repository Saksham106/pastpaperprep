import biologyTaxonomy from "@/data/igcse-biology-0610-official-taxonomy.json";
import economicsTaxonomy from "@/data/igcse-economics-0455-taxonomy.json";
import {
  getControlledSubtopics as getLegacyControlledSubtopics,
  getSubtopicGroups as getLegacySubtopicGroups,
  getTopicOptions as getLegacyTopicOptions,
} from "@/lib/taxonomy";
import type { UnifiedQuestion } from "@/lib/questions";

const BIOLOGY_TOPIC_ORDER = Array.from(new Set(
  biologyTaxonomy.eras.flatMap((era) => era.topics.flatMap((topic) => topic.subtopics.map((subtopic) => subtopic.title))),
));
const BIOLOGY_GROUPS: Record<string, readonly string[]> = Object.fromEntries(
  biologyTaxonomy.eras.flatMap((era) => era.topics.map((topic) => [
    topic.title,
    topic.subtopics.map((subtopic) => subtopic.title),
  ])),
);
const ECONOMICS_TOPIC_ORDER = economicsTaxonomy.student_topics.map((topic) => topic.label);
const ECONOMICS_GROUPS: Record<string, readonly string[]> = Object.fromEntries(
  economicsTaxonomy.student_topics.map((topic) => [
    topic.label,
    topic.detailed_subtopics.map((subtopic) => subtopic.label),
  ]),
);

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function isReleaseBank(bank: string | undefined): bank is "igcse-biology-0610" | "igcse-economics-0455" {
  return bank === "igcse-biology-0610" || bank === "igcse-economics-0455";
}

export function getControlledSubtopics(bankSlug: string, topic: string): readonly string[] {
  if (bankSlug === "igcse-biology-0610") {
    return BIOLOGY_GROUPS[topic] ?? (BIOLOGY_TOPIC_ORDER.includes(topic) ? [topic] : []);
  }
  if (bankSlug === "igcse-economics-0455") return ECONOMICS_GROUPS[topic] ?? [];
  return getLegacyControlledSubtopics(bankSlug, topic);
}

export function getTopicOptions(questions: UnifiedQuestion[]): string[] {
  const bank = questions[0]?.bankSlug;
  if (!isReleaseBank(bank)) return getLegacyTopicOptions(questions);
  const available = new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]));
  const order = bank === "igcse-biology-0610" ? BIOLOGY_TOPIC_ORDER : ECONOMICS_TOPIC_ORDER;
  const ordered = order.filter((topic) => available.has(topic));
  const remaining = [...available].filter((topic) => !ordered.includes(topic)).sort();
  return [...ordered, ...remaining];
}

export function getSubtopicGroups(
  questions: UnifiedQuestion[],
  selectedTopics: string[],
  selectedSubtopics: string[],
): { all: string[]; relevant: string[]; other: string[]; selectedOutsideContext: string[] } {
  const bank = questions[0]?.bankSlug;
  if (!isReleaseBank(bank)) return getLegacySubtopicGroups(questions, selectedTopics, selectedSubtopics);
  const all = uniqueSorted(questions.flatMap((question) => [...question.subtopics, ...question.skills]));
  const available = new Set(all);
  let relevant = all;
  if (selectedTopics.length) {
    if (bank === "igcse-economics-0455") {
      relevant = uniqueSorted(selectedTopics.flatMap((topic) => ECONOMICS_GROUPS[topic] ?? []).filter((label) => available.has(label)));
    } else {
      const selected = new Set(selectedTopics);
      relevant = uniqueSorted(questions
        .filter((question) => selected.has(question.primaryTopic) || question.secondaryTopics.some((topic) => selected.has(topic)))
        .flatMap((question) => [...question.subtopics, ...question.skills])
        .filter((label) => available.has(label)));
    }
  }
  const relevantSet = new Set(relevant);
  return {
    all,
    relevant,
    other: all.filter((subtopic) => !relevantSet.has(subtopic)),
    selectedOutsideContext: selectedSubtopics.filter((subtopic) => available.has(subtopic) && !relevantSet.has(subtopic)),
  };
}
