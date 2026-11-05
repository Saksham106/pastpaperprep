// Course registry and publish gate. Client-safe (plain data, no katex).
import type { CourseConfig } from "./config";
import { compareItems } from "./items";
import { COURSE_CONTENT } from "./registry";
import { isVisibleWhen } from "./visibility";
import type { CheatSheetFile, CommandTerm, GlossaryTerm, ItemsFile, Lesson, ViewLevel } from "./types";

export type { CommandTerm } from "./types";

export type Course = Omit<CourseConfig, "items"> & {
  /** The course's syllabus items, in file order (course.json holds the file's path). */
  items: ItemsFile;
  lessons: Lesson[];
  glossary: GlossaryTerm[];
  commandTerms: CommandTerm[];
  /** Sheet-only lines keyed by topic slug; a topic without a file has none. */
  cheatSheets: Record<string, CheatSheetFile>;
  /** Figure id to inline SVG markup, for `figure` blocks. */
  figures: Record<string, string>;
};

export const COURSES: readonly Course[] = COURSE_CONTENT.map((content) => ({
  ...content.course,
  items: content.items,
  lessons: [...content.lessons].sort((a, b) => a.topic - b.topic || compareItems(a.item, b.item)),
  glossary: content.glossary,
  commandTerms: content.commandTerms,
  cheatSheets: content.cheatSheets,
  figures: content.figures,
}));

export const getCourse = (slug: string): Course | undefined => COURSES.find((course) => course.slug === slug);

export const getLesson = (courseSlug: string, item: string): Lesson | undefined => getCourse(courseSlug)?.lessons.find((lesson) => lesson.item === item);

export const lessonsForTopic = (course: Course, topic: number): Lesson[] => course.lessons.filter((lesson) => lesson.topic === topic);

const topicSlug = (course: Course, topic: number) => course.topics.find((entry) => entry.n === topic)?.slug ?? String(topic);

export const coursePath = (course: Pick<Course, "slug">): string => `/revision-notes/${course.slug}`;

export const topicPath = (course: Course, topic: number): string => `${coursePath(course)}/${topicSlug(course, topic)}`;

export const lessonPath = (course: Course, lesson: Lesson): string => `${topicPath(course, lesson.topic)}/${lesson.item.replace(".", "-")}-${lesson.slug}`;

export const isCourseVisible = (course: Course): boolean => isVisibleWhen(course.published);

/** The course when visible, else undefined (its route pages then 404). */
export const getVisibleCourse = (slug: string): Course | undefined => {
  const course = getCourse(slug);
  return course && isCourseVisible(course) ? course : undefined;
};

/** True for a lesson or item stored at the course's extension level (AA: "AHL"). */
export const isExtension = (course: Pick<Course, "levels">, level: string): boolean => level === course.levels.extension;

/** Shown in that view: the extension view shows everything, the base view only base-level entries. */
export const shownIn = (course: Pick<Course, "levels">, view: ViewLevel, level: string): boolean => view === "extension" || level === course.levels.base;

/** The bank a view practises in (AA: ib-sl / ib-hl). */
export const bankFor = (course: Pick<Course, "banks" | "levels">, view: ViewLevel): string => course.banks[course.levels.labels[view]];

/** Static params and sitemap source: nothing until a course is published (or previewed). */
export function coursePaths(): string[] {
  return COURSES.filter(isCourseVisible).flatMap((course) => [
    coursePath(course),
    ...course.topics.map((topic) => topicPath(course, topic.n)),
    ...course.lessons.map((lesson) => lessonPath(course, lesson)),
    `${coursePath(course)}/cheat-sheet`,
    ...course.topics.map((topic) => `${topicPath(course, topic.n)}/cheat-sheet`),
    ...(course.glossary.length ? [`${coursePath(course)}/glossary`] : []),
    ...(course.commandTerms.length ? [`${coursePath(course)}/command-terms`] : []),
  ]);
}
