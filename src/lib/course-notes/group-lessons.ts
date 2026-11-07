// Maps bank questions to written lessons ("Learn this topic", the explanation's "Revise" link, paper reports,
// the syllabus page). Server-side: loads the courses. Every link is gated by its course's visibility.
import { COURSES, isCourseVisible, lessonPath, lessonsForTopic, type Course } from "./course";
import { GROUPS } from "./groups";
import { compareItems } from "./items";
import type { PracticeLevel } from "./practice";
import { subtopicPracticeFile } from "./subtopic-practice";
import type { Lesson, ViewLevel } from "./types";

export type LessonLink = { href: string; label: string };

const BANK_LEVELS: Record<string, PracticeLevel> = { "ib-sl": "SL", "ib-hl": "HL" };

/** First written lesson among the group's items, in syllabus order, at that level (SL sees only SL items). Null when none, or the course is hidden. */
export function lessonForGroup(course: Course, groupId: string, level: PracticeLevel): LessonLink | null {
  if (!isCourseVisible(course)) return null;
  const group = GROUPS.find((entry) => entry.id === groupId);
  if (!group) return null;
  for (const item of [...group.memberOfficialItems].sort(compareItems)) {
    const lesson = course.lessons.find((entry) => entry.item === item && (level === "HL" || entry.level === "SL"));
    if (lesson) return { href: lessonPath(course, lesson), label: lesson.title };
  }
  return null;
}

/** The written lesson for one syllabus item at that level (SL sees only SL items). Null when none, or the course is hidden. */
export function lessonForItem(course: Course, item: string, level: PracticeLevel): LessonLink | null {
  if (!isCourseVisible(course)) return null;
  const lesson = course.lessons.find((entry) => entry.item === item && (level === "HL" || entry.level === "SL"));
  return lesson ? { href: lessonPath(course, lesson), label: lesson.title } : null;
}

/** AA bank: keys are syllabus item ids ("5.16") and group student-facing names (the fallback for an untagged question). */
function aaLinks(course: Course, level: PracticeLevel): Record<string, LessonLink> {
  const links: Record<string, LessonLink> = {};
  for (const lesson of course.lessons) {
    const link = lessonForItem(course, lesson.item, level);
    if (link) links[lesson.item] = link;
  }
  for (const group of GROUPS) {
    const link = lessonForGroup(course, group.id, level);
    if (link) links[group.studentFacingName] = link;
  }
  return links;
}

/**
 * Official-codes bank: keys are the `officialCodeRefs` a question carries ("current_2025:C1.1"). A Core
 * question's code belongs to a section with a Core lesson, so each lesson links from both its codes.
 */
function codeLinks(course: Course): Record<string, LessonLink> {
  const practice = course.practice;
  if (practice.kind !== "official-codes") return {};
  const links: Record<string, LessonLink> = {};
  for (const lesson of course.lessons) {
    const link = { href: lessonPath(course, lesson), label: lesson.title };
    for (const view of ["base", "extension"] as ViewLevel[]) {
      if (view === "base" && lesson.level !== course.levels.base) continue;
      links[`${practice.refPrefix}${practice.codes[view].replace("{item}", lesson.item)}`] = link;
    }
  }
  return links;
}

/** The view a bank belongs to in a course: the extension level's bank sees every lesson, the base level's only base lessons. */
const bankView = (course: Course, bankSlug: string): ViewLevel => (course.banks[course.levels.labels.extension] === bankSlug ? "extension" : "base");

/**
 * Bank-subtopics course: each practice label with a written lesson, in item order, and the first such lesson (the
 * base level's bank only links base lessons). `shared` when more items than one practise the label.
 */
function subtopicLessons(course: Course, bankSlug: string): { label: string; lesson: Lesson; shared: boolean }[] {
  const view = bankView(course, bankSlug);
  const entries = [...course.items.items].sort((a, b) => a.topic - b.topic || compareItems(a.item, b.item));
  const found = new Map<string, { label: string; lesson: Lesson; shared: boolean }>();
  for (const entry of entries) {
    if (!entry.practice || found.has(entry.practice)) continue;
    const lesson = course.lessons.find((candidate) => candidate.item === entry.item && (view === "extension" || candidate.level === course.levels.base));
    if (lesson) found.set(entry.practice, { label: entry.practice, lesson, shared: entries.filter((other) => other.practice === entry.practice).length > 1 });
  }
  return [...found.values()];
}

/** Bank-subtopics bank: keys are the subtopic labels questions carry. A label several lessons share is the link's text. */
function subtopicLinks(course: Course, bankSlug: string): Record<string, LessonLink> {
  return Object.fromEntries(subtopicLessons(course, bankSlug).map(({ label, lesson, shared }) => [label, { href: lessonPath(course, lesson), label: shared ? label : lesson.title }]));
}

/** Visible courses practised in that bank. */
const coursesForBank = (bankSlug: string) => COURSES.filter((course) => isCourseVisible(course) && Object.values(course.banks).includes(bankSlug));

/**
 * Lesson links for a bank page; undefined unless a course practised there is visible and has a link.
 * The explorer looks a question up by its item tags, then its subtopics, then its official code refs.
 */
export function notesLinksForBank(bankSlug: string): Record<string, LessonLink> | undefined {
  const links: Record<string, LessonLink> = {};
  for (const course of coursesForBank(bankSlug)) {
    if (course.practice.kind === "aa-items") {
      const level = BANK_LEVELS[bankSlug];
      if (level) Object.assign(links, aaLinks(course, level));
    } else if (course.practice.kind === "bank-subtopics") Object.assign(links, subtopicLinks(course, bankSlug));
    else Object.assign(links, codeLinks(course));
  }
  return Object.keys(links).length ? links : undefined;
}

/** Parent topic name to its topic notes page, for paper reports (topics there are primary topics). */
export function notesTopicLinksForBank(bankSlug: string): Record<string, LessonLink> | undefined {
  const course = coursesForBank(bankSlug)[0];
  if (!course) return undefined;
  if (course.practice.kind === "bank-subtopics") {
    // The bank's topics are not the course's: each opens the first lesson practising one of its subtopics.
    const parents = subtopicPracticeFile(course).parents;
    const links: Record<string, LessonLink> = {};
    for (const { label, lesson } of subtopicLessons(course, bankSlug)) {
      const topic = parents[label];
      if (topic && !links[topic]) links[topic] = { href: lessonPath(course, lesson), label: lesson.title };
    }
    return Object.keys(links).length ? links : undefined;
  }
  return Object.fromEntries(course.topics.filter((topic) => lessonsForTopic(course, topic.n).length).map((topic) => [topic.name, { href: `/revision-notes/${course.slug}/${topic.slug}`, label: `${topic.name} notes` }]));
}

export type SyllabusNote = { name: string; topic: string; href: string; label: string };

/** AA syllabus groups with a written lesson, in teaching order. */
function aaSyllabusNotes(course: Course, level: PracticeLevel): SyllabusNote[] {
  return [...GROUPS]
    .filter((group) => group.applicability.includes(level))
    .sort((a, b) => a.teachingOrder - b.teachingOrder)
    .flatMap((group) => {
      const link = lessonForGroup(course, group.id, level);
      return link ? [{ name: group.studentFacingName, topic: group.parentTopic, ...link }] : [];
    });
}

/** Official-codes course: each section with a written lesson, in syllabus order. */
function sectionSyllabusNotes(course: Course): SyllabusNote[] {
  return [...course.lessons].sort((a, b) => compareItems(a.item, b.item)).map((lesson) => ({
    name: `${lesson.item} ${course.items.items.find((entry) => entry.item === lesson.item)?.name ?? lesson.title}`,
    topic: course.topics.find((topic) => topic.n === lesson.topic)?.name ?? "",
    href: lessonPath(course, lesson),
    label: lesson.title,
  }));
}

/** Lessons for the bank's syllabus page, from every visible course practised there. Empty while those courses are hidden. */
export function syllabusNotesForBank(bankSlug: string): SyllabusNote[] {
  return coursesForBank(bankSlug).flatMap((course) => {
    if (course.practice.kind === "aa-items") {
      const level = BANK_LEVELS[bankSlug];
      return level ? aaSyllabusNotes(course, level) : [];
    }
    if (course.practice.kind === "bank-subtopics") {
      const parents = subtopicPracticeFile(course).parents;
      return subtopicLessons(course, bankSlug).map(({ label, lesson }) => ({ name: label, topic: parents[label] ?? "", href: lessonPath(course, lesson), label: lesson.title }));
    }
    return sectionSyllabusNotes(course);
  });
}
