import { parseExplorerState } from "@/lib/explorer-state";
import { filterQuestions } from "@/lib/question-filter";
import type { UnifiedQuestion } from "@/lib/questions";
import type { SearchTopic } from "@/lib/site-search";

/** A curated topic landing page and the question count it shows. */
export type LandingLink = { label: string; href: string; count: number };

/**
 * Every syllabus topic and subtopic in one bank, for the site search. Curated topics link to their
 * landing page with that page's own count. The rest open the bank filtered to the label, counted
 * with the explorer's own filter. Those links say free=0, because visitors otherwise default to
 * free questions only and a topic can have none. Locked questions stay locked, but the count and
 * the page agree.
 */
export function buildSearchTopics(bankSlug: string, questions: readonly UnifiedQuestion[], landings: readonly LandingLink[], hasFreeTier: boolean): SearchTopic[] {
  const landing = new Map(landings.map(link => [link.label, link]));
  const filtered = (key: "topic" | "subtopic", label: string) => {
    const params = new URLSearchParams(hasFreeTier ? { free: "0", [key]: label } : { [key]: label });
    return `/banks/${bankSlug}?${params}`;
  };
  // Count through the explorer's own URL parsing, so a label it would drop (e.g. over its length
  // limit) gets no link rather than one that silently opens the whole bank.
  const shown = (key: "topic" | "subtopic", label: string) => {
    const state = parseExplorerState(Object.fromEntries(new URL(filtered(key, label), "https://x").searchParams));
    const kept = (key === "topic" ? state.filters.topics : state.filters.subtopics)?.includes(label);
    return kept ? filterQuestions([...questions], { ...state.filters, sort: "paper" }).length : 0;
  };

  const topicLabels = new Set<string>();
  // A subtopic's parent is the topic most of its questions sit under.
  const subtopicParents = new Map<string, Map<string, number>>();
  for (const q of questions) {
    if (q.primaryTopic) topicLabels.add(q.primaryTopic);
    for (const sub of q.subtopics) {
      const parents = subtopicParents.get(sub) ?? new Map<string, number>();
      parents.set(q.primaryTopic, (parents.get(q.primaryTopic) ?? 0) + 1);
      subtopicParents.set(sub, parents);
    }
  }

  const topics: SearchTopic[] = [];
  for (const label of topicLabels) {
    const page = landing.get(label);
    const count = page ? page.count : shown("topic", label);
    if (count) topics.push({ bank: bankSlug, label, parent: null, href: page ? page.href : filtered("topic", label), count });
  }
  for (const [label, parents] of subtopicParents) {
    if (!label || topicLabels.has(label)) continue;
    const count = shown("subtopic", label);
    const parent = [...parents].sort((a, b) => b[1] - a[1])[0][0];
    if (count) topics.push({ bank: bankSlug, label, parent, href: filtered("subtopic", label), count });
  }
  return topics;
}
