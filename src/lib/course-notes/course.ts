// Course registry and publish gate. Client-safe (plain data, no katex).
import courseJson from "@/content/notes/ib-math-aa/course.json";
import commandTermsJson from "@/content/notes/ib-math-aa/command-terms.json";
import glossaryJson from "@/content/notes/ib-math-aa/glossary.json";
import { cheatSheets, figures, lessons } from "@/content/notes/ib-math-aa";
import { compareItems } from "./items";
import { isVisibleWhen } from "./visibility";
import type { CheatSheetFile, GlossaryTerm, Lesson } from "./types";

export type CommandTerm = { id: string; term: string; definition: string };

export type Course = {
  slug: "ib-math-aa";
  name: string;
  published: boolean;
  banks: { SL: "ib-sl"; HL: "ib-hl" };
  topics: { n: 1 | 2 | 3 | 4 | 5; slug: string; name: string }[];
  lessons: Lesson[];
  glossary: GlossaryTerm[];
  commandTerms: CommandTerm[];
  /** Sheet-only lines keyed by topic slug; a topic without a file has none. */
  cheatSheets: Record<string, CheatSheetFile>;
  /** Figure id to inline SVG markup, for `figure` blocks. */
  figures: Record<string, string>;
};

const base = courseJson as Pick<Course, "slug" | "name" | "published" | "banks" | "topics">;

export const COURSES: readonly Course[] = [
  {
    ...base,
    lessons: [...lessons].sort((a, b) => a.topic - b.topic || compareItems(a.item, b.item)),
    glossary: glossaryJson as GlossaryTerm[],
    commandTerms: commandTermsJson as CommandTerm[],
    cheatSheets,
    figures,
  },
];

export const getCourse = (slug: string): Course | undefined => COURSES.find((course) => course.slug === slug);

export const getLesson = (courseSlug: string, item: string): Lesson | undefined => getCourse(courseSlug)?.lessons.find((lesson) => lesson.item === item);

export const lessonsForTopic = (course: Course, topic: number): Lesson[] => course.lessons.filter((lesson) => lesson.topic === topic);

const topicSlug = (course: Course, topic: number) => course.topics.find((entry) => entry.n === topic)?.slug ?? String(topic);

export const topicPath = (course: Course, topic: number): string => `/revision-notes/${course.slug}/${topicSlug(course, topic)}`;

export const lessonPath = (course: Course, lesson: Lesson): string => `${topicPath(course, lesson.topic)}/${lesson.item.replace(".", "-")}-${lesson.slug}`;

export const isCourseVisible = (course: Course): boolean => isVisibleWhen(course.published);

/** The AA course when visible, else undefined (route pages then 404). */
export const getVisibleCourse = (): Course | undefined => {
  const course = COURSES[0];
  return course && isCourseVisible(course) ? course : undefined;
};

/** Static params and sitemap source: nothing until the course is published (or previewed). */
export function coursePaths(): string[] {
  return COURSES.filter(isCourseVisible).flatMap((course) => [
    `/revision-notes/${course.slug}`,
    ...course.topics.map((topic) => topicPath(course, topic.n)),
    ...course.lessons.map((lesson) => lessonPath(course, lesson)),
    `/revision-notes/${course.slug}/cheat-sheet`,
    ...course.topics.map((topic) => `${topicPath(course, topic.n)}/cheat-sheet`),
    `/revision-notes/${course.slug}/glossary`,
    `/revision-notes/${course.slug}/command-terms`,
  ]);
}
