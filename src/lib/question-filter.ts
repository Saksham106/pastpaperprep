import { canonicalBiology0610Topic } from "@/lib/biology-0610-topic-aliases";
import type { QuestionFilters, UnifiedQuestion } from "@/lib/questions";
import { isLocalEconomicsBank } from "@/lib/banks";
import { BIOLOGY_0610_EARLIER, BIOLOGY_0610_SECTIONS, display0610Sections } from "@/lib/igcse-0610-official.mjs";
import { COORDINATED_0654_EARLIER, COORDINATED_0654_SECTIONS, display0654Sections } from "@/lib/igcse-0654-official.mjs";
import { PHYSICS_0625_EARLIER, PHYSICS_0625_REVIEW, PHYSICS_0625_SECTIONS, display0625Sections } from "@/lib/igcse-0625-official.mjs";
import { CHEMISTRY_0620_EARLIER, CHEMISTRY_0620_REVIEW, CHEMISTRY_0620_SECTIONS, display0620Sections } from "@/lib/igcse-0620-official.mjs";

/** Reused across sorts so topic sorting does not build a fresh collator per comparison. */
const topicCollator = new Intl.Collator(undefined, { numeric: true });
const biology0610CurrentHeadings = new Set<string>([...BIOLOGY_0610_SECTIONS.map((section) => section.title), BIOLOGY_0610_EARLIER]);
const coordinated0654Headings = new Set<string>([...COORDINATED_0654_SECTIONS.map((section) => section.studentTitle), COORDINATED_0654_EARLIER]);
const physics0625Headings = new Set<string>([...PHYSICS_0625_SECTIONS.map((section) => section.title), PHYSICS_0625_EARLIER, PHYSICS_0625_REVIEW]);
const chemistry0620Headings = new Map<string, string>(CHEMISTRY_0620_SECTIONS.map((section) => [section.title, section.code]));
chemistry0620Headings.set(CHEMISTRY_0620_EARLIER, "earlier:content");
chemistry0620Headings.set(CHEMISTRY_0620_REVIEW, "unresolved:current");

function includesAny(selected: string[] | undefined, values: string[]): boolean {
  return !selected?.length || selected.some((value) => values.includes(value));
}

function filterableTopics(question: UnifiedQuestion): string[] {
  const topics = [question.primaryTopic, ...question.secondaryTopics];
  // 0610's 2026–28 wording supersedes two older labels. Keep the stored
  // classifications untouched, but make the current official choice retrieve
  // semantically equivalent archive questions too.
  if (question.bankSlug === "igcse-biology-0610") {
    return [...new Set([...topics, ...topics.map(canonicalBiology0610Topic)])];
  }
  return topics;
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
    if (filters.subtopics?.length && question.bankSlug === "igcse-biology-0610") {
      const visible = display0610Sections(question.officialCodeRefs ?? []);
      const aliases = filterableSubtopics(question);
      if (!filters.subtopics.some((label) => biology0610CurrentHeadings.has(label) ? visible.includes(label) : aliases.includes(label))) return false;
    } else if (filters.subtopics?.length && question.bankSlug === "igcse-coordinated-sciences-0654") {
      const visible = display0654Sections(question.officialCodeRefs ?? []);
      const aliases = filterableSubtopics(question);
      if (!filters.subtopics.some((label) => coordinated0654Headings.has(label) ? visible.includes(label) : aliases.includes(label))) return false;
    } else if (filters.subtopics?.length && question.bankSlug === "igcse-physics-0625") {
      const visible = display0625Sections(question.officialCodeRefs ?? []);
      const aliases = filterableSubtopics(question);
      if (!filters.subtopics.some((label) => physics0625Headings.has(label) ? visible.includes(label) : aliases.includes(label))) return false;
    } else if (filters.subtopics?.length && question.bankSlug === "igcse-chemistry-0620") {
      const visible = display0620Sections(question.officialCodeRefs ?? []);
      const aliases = filterableSubtopics(question);
      if (!filters.subtopics.some((label) => {
        const code = chemistry0620Headings.get(label);
        return code ? visible.includes(label) || (code !== "earlier:content" && code !== "unresolved:current" && question.officialCodeRefs?.includes(`alias_current:${code}`)) : aliases.includes(label);
      })) return false;
    } else if (!includesAny(filters.subtopics, filterableSubtopics(question))) return false;
    if (!includesAny(filters.granularLabels, question.granularLabels ?? [])) return false;
    if (!includesAny(filters.officialCodeRefs, question.officialCodeRefs ?? [])) return false;
    if (!includesAny(filters.retrievalFacets, question.retrievalFacets ?? [])) return false;
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
