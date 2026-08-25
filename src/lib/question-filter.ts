import type { QuestionFilters, UnifiedQuestion } from "@/lib/questions";

function includesAny(selected: string[] | undefined, values: string[]): boolean {
  return !selected?.length || selected.some((value) => values.includes(value));
}

export function filterQuestions(questions: UnifiedQuestion[], filters: QuestionFilters): UnifiedQuestion[] {
  const search = filters.search?.trim().toLocaleLowerCase();
  const filtered = questions.filter((question) => {
    if (filters.topic && question.primaryTopic !== filters.topic) return false;
    if (filters.year && question.year !== Number(filters.year)) return false;
    if (filters.paper && question.paper !== Number(filters.paper)) return false;
    if (!includesAny(filters.topics, [question.primaryTopic, ...question.secondaryTopics])) return false;
    if (!includesAny(filters.subtopics, question.subtopics)) return false;
    if (!includesAny(filters.years, [String(question.year)])) return false;
    if (!includesAny(filters.papers, [String(question.paper)])) return false;
    if (!includesAny(filters.sessions, [question.session])) return false;
    if (!includesAny(filters.subjects, [question.subject])) return false;
    if (!includesAny(filters.zones, [question.zone])) return false;
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
    if (filters.sort === "topic") return a.primaryTopic.localeCompare(b.primaryTopic) || b.year - a.year;
    return b.year - a.year || a.paper - b.paper || a.number - b.number;
  });
}
