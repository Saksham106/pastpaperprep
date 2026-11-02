// Maps bank subtopic groups to written lessons. Server-side: loads the course.
import { COURSES, getCourse, isCourseVisible, lessonPath, lessonsForTopic, type Course } from "./course";
import { GROUPS } from "./groups";
import { compareItems } from "./items";
import type { PracticeLevel } from "./practice";

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

/** Group student-facing name to lesson link for an AA bank page; undefined unless the course is visible and has a link. */
export function notesLinksForBank(bankSlug: string): Record<string, LessonLink> | undefined {
  const level = BANK_LEVELS[bankSlug];
  const course = getCourse("ib-math-aa");
  if (!level || !course || !isCourseVisible(course)) return undefined;
  const links: Record<string, LessonLink> = {};
  for (const group of GROUPS) {
    const link = lessonForGroup(course, group.id, level);
    if (link) links[group.studentFacingName] = link;
  }
  return Object.keys(links).length ? links : undefined;
}

/** Parent topic name to its topic notes page, for paper reports (topics there are primary topics). */
export function notesTopicLinksForBank(bankSlug: string): Record<string, LessonLink> | undefined {
  const course = COURSES.find((entry) => BANK_LEVELS[bankSlug] && entry.banks[BANK_LEVELS[bankSlug]] === bankSlug);
  if (!course || !isCourseVisible(course)) return undefined;
  return Object.fromEntries(course.topics.filter((topic) => lessonsForTopic(course, topic.n).length).map((topic) => [topic.name, { href: `/revision-notes/${course.slug}/${topic.slug}`, label: `${topic.name} notes` }]));
}

/** AA syllabus groups with a written lesson, in teaching order, for the syllabus page. Empty unless the course is visible. */
export function syllabusNotesForBank(bankSlug: string): { name: string; topic: string; href: string; label: string }[] {
  const level = BANK_LEVELS[bankSlug];
  const course = getCourse("ib-math-aa");
  if (!level || !course || !isCourseVisible(course)) return [];
  return [...GROUPS]
    .filter((group) => group.applicability.includes(level))
    .sort((a, b) => a.teachingOrder - b.teachingOrder)
    .flatMap((group) => {
      const link = lessonForGroup(course, group.id, level);
      return link ? [{ name: group.studentFacingName, topic: group.parentTopic, ...link }] : [];
    });
}
