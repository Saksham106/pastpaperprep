// Counts for `bank-subtopics` courses (IB Chemistry). Counting needs the raw banks, so it runs only in
// scripts/generate-notes-practice.mts and the test that checks the generated file; pages read that file
// (subtopic-practice.ts).
import { parseExplorerState } from "@/lib/explorer-state";
import { filterQuestions } from "@/lib/question-filter";
import type { UnifiedQuestion } from "@/lib/questions";
import type { CourseConfig } from "./config";
import { subtopicHref, type SubtopicPracticeFile } from "./subtopic-practice";
import type { ItemsFile } from "./types";

/** The ids the bank page lists for that link, through the explorer's own URL parsing and filter (with full access). */
export function idsShown(questions: readonly UnifiedQuestion[], href: string): string[] {
  const url = new URL(href, "https://example.test");
  const state = parseExplorerState(Object.fromEntries(url.searchParams));
  const label = url.searchParams.get("subtopic");
  // A label the explorer drops (over its length limit) would open the whole bank: count nothing rather than that.
  if (!label || !state.filters.subtopics?.includes(label)) return [];
  return filterQuestions([...questions], { ...state.filters, mainTopicOnly: !state.partialTopics, sort: "paper" }).map((question) => question.id);
}

/** Every distinct label in item order. */
export const practiceLabels = (items: ItemsFile): string[] => [...new Set(items.items.flatMap((entry) => entry.practice ?? []))];

/** Builds the course's practice file from each level's bank questions. */
export function buildSubtopicPractice(
  course: Pick<CourseConfig, "slug" | "levels" | "banks">,
  items: ItemsFile,
  questions: Record<string, readonly UnifiedQuestion[]>,
  freeTier: (bank: string) => boolean,
): SubtopicPracticeFile {
  const { labels, base } = course.levels;
  const levelLabels = [labels.base, labels.extension];
  const banks = Object.fromEntries(levelLabels.map((level) => [level, { slug: course.banks[level], freeTier: freeTier(course.banks[level]) }]));
  const shown = new Map<string, Record<string, string[]>>();
  for (const label of practiceLabels(items)) {
    shown.set(label, Object.fromEntries(levelLabels.map((level) => [level, idsShown(questions[level], subtopicHref(banks[level].slug, label, banks[level].freeTier))])));
  }
  const subtopics = Object.fromEntries([...shown].map(([label, ids]) => [label, Object.fromEntries(levelLabels.map((level) => [level, ids[level].length]))]));
  const topicNumbers = [...new Set(items.items.map((entry) => entry.topic))].sort((a, b) => a - b);
  const topics = Object.fromEntries(topicNumbers.map((n) => {
    const entries = items.items.filter((entry) => entry.topic === n && entry.practice);
    const distinct = (level: string, keep: (entryLevel: string) => boolean) => new Set(entries.filter((entry) => keep(entry.level)).flatMap((entry) => shown.get(entry.practice!)![level])).size;
    return [String(n), { [labels.base]: distinct(labels.base, (level) => level === base), [labels.extension]: distinct(labels.extension, () => true) }];
  }));
  const parents = Object.fromEntries([...shown.keys()].flatMap((label) => {
    const tally = new Map<string, number>();
    for (const level of levelLabels) for (const question of questions[level]) if (question.subtopics.includes(label) && question.primaryTopic) tally.set(question.primaryTopic, (tally.get(question.primaryTopic) ?? 0) + 1);
    const top = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return top ? [[label, top[0]]] : [];
  }));
  return { course: course.slug, banks, subtopics, topics, parents };
}
