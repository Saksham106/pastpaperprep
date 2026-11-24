import type { Metadata } from "next";
import { socialPreview } from "@/lib/seo";
import { lessonPath, topicPath, type Course } from "./course";
import { fitMetaDescription, inlineToPlainText } from "./plain-text";
import type { Lesson } from "./types";

export const SITE_URL = "https://pastpaperprep.com";
const MAX_TITLE = 60;

/** Absolute titles stay within 60 characters: drop the suffix first, then truncate. */
export function fitTitle(title: string, suffix = ""): string {
  const full = `${title}${suffix}`;
  if (full.length <= MAX_TITLE) return full;
  if (title.length <= MAX_TITLE) return title;
  return `${title.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

/**
 * Notes titles always name the course: "Limits and the derivative | IB Maths AA" beats a bare lesson name,
 * which AA and AI share. Prefer " | <course> Notes", then " | <course>"; the short form may run to 70
 * characters, since a missing course name costs more than a truncated tail.
 */
export function notesTitle(title: string, courseName: string): string {
  const long = `${title} | ${courseName} Notes`;
  if (long.length <= MAX_TITLE) return long;
  const short = `${title} | ${courseName}`;
  return short.length <= 70 ? short : fitTitle(title);
}

export function courseMeta(title: string, description: string, path: string, type: "website" | "article" = "website"): Metadata {
  return {
    title: { absolute: fitTitle(title) },
    description,
    alternates: { canonical: path },
    openGraph: { url: path, type, ...socialPreview() },
  };
}

export const homeMeta = (course: Course) =>
  courseMeta(`${course.name} Course Notes: Every Topic`, `Free ${course.name} course notes for every syllabus topic, with worked examples, checks and links to real past-paper questions.`, `/revision-notes/${course.slug}`);

export const topicMeta = (course: Course, topic: Course["topics"][number]) =>
  courseMeta(notesTitle(topic.name, course.name), `${course.name} notes on ${topic.name.toLowerCase()}: every lesson, with worked examples and checks.`, topicPath(course, topic.n));

export const lessonMeta = (course: Course, lesson: Lesson) =>
  courseMeta(notesTitle(lesson.title, course.name), fitMetaDescription(inlineToPlainText(lesson.summary)), lessonPath(course, lesson), "article");

export const cheatSheetMeta = (course: Course, topic?: Course["topics"][number]) =>
  courseMeta(
    fitTitle(topic ? `${topic.name} Cheat Sheet | ${course.name}` : `${course.name} Cheat Sheet: Key Formulas`),
    topic
      ? `${course.name} ${topic.name.toLowerCase()} cheat sheet: the key formulas and facts on one page, each linked to the lesson that teaches it.`
      : `${course.name} cheat sheet: the key formulas and facts for every topic on one page, each linked to the lesson that teaches it.`,
    topic ? `${topicPath(course, topic.n)}/cheat-sheet` : `/revision-notes/${course.slug}/cheat-sheet`,
  );

export const glossaryMeta = (course: Course) =>
  courseMeta(`${course.name} Glossary: Key Terms`, `Plain-words definitions of the key terms in ${course.name}, linked to the lessons that teach them.`, `/revision-notes/${course.slug}/glossary`);

export const commandTermsMeta = (course: Course) =>
  courseMeta(`${course.name} Command Terms Explained`, `What each ${course.copy.board} command term asks you to do in ${course.name} exams.`, `/revision-notes/${course.slug}/command-terms`);

/** BreadcrumbList JSON-LD for notes pages: Notes › course › topic › lesson, matching the visible crumbs. */
export function notesBreadcrumb(items: readonly { name: string; path: string }[]): Record<string, unknown> {
  const all = [{ name: "Revision notes", path: "/revision-notes" }, ...items];
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: all.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: `${SITE_URL}${item.path}` })) };
}
