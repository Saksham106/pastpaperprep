import type { QuestionFilters, UnifiedQuestion } from "@/lib/questions";
import { isLocalEconomicsBank } from "@/lib/banks";

/** Reused across sorts so topic sorting does not build a fresh collator per comparison. */
const topicCollator = new Intl.Collator(undefined, { numeric: true });

function includesAny(selected: string[] | undefined, values: string[]): boolean {
  return !selected?.length || selected.some((value) => values.includes(value));
}

function filterableTopics(question: UnifiedQuestion): string[] {
  return [question.primaryTopic, ...question.secondaryTopics];
}

function filterableSubtopics(question: UnifiedQuestion): string[] {
  return isLocalEconomicsBank(question.bankSlug)
    ? [...new Set(question.subtopics)]
    : [...new Set([...question.subtopics, ...question.skills])];
}

export function questionZoneValue(question: UnifiedQuestion): string {
  if (question.zone) return question.zone;
  if ((question.bankSlug === "igcse" || question.bankSlug === "igcse-additional") && /[123]$/.test(question.component)) {
    return `Variant ${question.component.at(-1)}`;
  }
  return "";
}

export function filterQuestions(questions: UnifiedQuestion[], filters: QuestionFilters): UnifiedQuestion[] {
  const search = filters.search?.trim().toLocaleLowerCase();
  // `topic` is the legacy singular spelling. Treat it as a one-value `topics`
  // filter so old callers cannot silently lose secondary-topic matches.
  const selectedTopics = filters.topics?.length
    ? filters.topics
    : filters.topic
      ? [filters.topic]
      : undefined;
  const filtered = questions.filter((question) => {
    if (filters.year && question.year !== Number(filters.year)) return false;
    if (filters.paper && question.paper !== Number(filters.paper)) return false;
    if (!includesAny(selectedTopics, filterableTopics(question))) return false;
    // `skills` is the canonical filterable classification vocabulary. Keep
    // accepting legacy `subtopics`, but never let a correctly classified
    // secondary skill disappear because an older bank omitted it there.
    if (!includesAny(filters.subtopics, filterableSubtopics(question))) return false;
    if (!includesAny(filters.granularLabels, question.granularLabels ?? [])) return false;
    if (!includesAny(filters.years, [String(question.year)])) return false;
    if (!includesAny(filters.papers, [String(question.paper)])) return false;
    if (!includesAny(filters.sessions, [question.session])) return false;
    if (!includesAny(filters.subjects, [question.subject])) return false;
    if (!includesAny(filters.zones, [questionZoneValue(question)])) return false;
    if (!includesAny(filters.courseEras, [question.courseEra])) return false;
    if (!includesAny(filters.options, [question.option])) return false;
    if (!includesAny(filters.components, [question.component])) return false;
    if (filters.calculator?.length) {
      const mode = question.calculator ? "calculator" : "non-calculator";
      if (!filters.calculator.includes(mode)) return false;
    }
    if (search && !question.searchText.includes(search)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (filters.sort === "marks-desc") return (b.marks ?? -1) - (a.marks ?? -1);
    if (filters.sort === "marks-asc") return (a.marks ?? Number.MAX_SAFE_INTEGER) - (b.marks ?? Number.MAX_SAFE_INTEGER);
    if (filters.sort === "topic") return topicCollator.compare(a.primaryTopic, b.primaryTopic) || b.year - a.year;
    return b.year - a.year || a.paper - b.paper || a.number - b.number;
  });
}
