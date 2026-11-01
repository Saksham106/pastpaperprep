import type { Metadata } from "next";
import { socialPreview } from "@/lib/seo";
import { lessonPath, topicPath, type Course } from "./course";
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
  courseMeta(fitTitle(topic.name, ` | ${course.name} Notes`), `${course.name} notes on ${topic.name.toLowerCase()}: every lesson, with worked examples and checks.`, topicPath(course, topic.n));

export const lessonMeta = (course: Course, lesson: Lesson) =>
  courseMeta(fitTitle(lesson.title, ` | ${course.name} Notes`), lesson.summary, lessonPath(course, lesson), "article");

export const cheatSheetMeta = (course: Course, topic?: Course["topics"][number]) =>
  courseMeta(
    fitTitle(topic ? `${topic.name} Cheat Sheet | ${course.name}` : `${course.name} Cheat Sheet: Key Formulas`),
    `Key formulas and facts for ${topic ? topic.name.toLowerCase() : course.name} on one page.`,
    topic ? `${topicPath(course, topic.n)}/cheat-sheet` : `/revision-notes/${course.slug}/cheat-sheet`,
  );

export const glossaryMeta = (course: Course) =>
  courseMeta(`${course.name} Glossary: Key Terms`, `Plain-words definitions of the key terms in ${course.name}, linked to the lessons that teach them.`, `/revision-notes/${course.slug}/glossary`);

export const commandTermsMeta = (course: Course) =>
  courseMeta(`${course.name} Command Terms Explained`, `What each IB command term asks you to do in ${course.name} exams.`, `/revision-notes/${course.slug}/command-terms`);
