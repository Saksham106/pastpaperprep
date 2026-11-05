// Shared by the course-notes page modules: resolving a course and its topic from route params, and the provider
// that gives client components the course's labels, banks and storage keys.
import type { ReactNode } from "react";
import { clientCourse } from "@/lib/course-notes/client-course";
import { getVisibleCourse, type Course } from "@/lib/course-notes/course";
import { CourseNotesProvider } from "../notes-context";

export type TopicParams = { params: Promise<{ topic: string }> };
export type LessonParams = { params: Promise<{ topic: string; lesson: string }> };

export function withCourse(course: Course, children: ReactNode) {
  return <CourseNotesProvider course={clientCourse(course)}>{children}</CourseNotesProvider>;
}

/** Params for a page with no dynamic segment: one entry once the course is visible, none before. */
export const singleParams = (slug: string) => (getVisibleCourse(slug) ? [{}] : []);

/** Topic params once the course is visible. */
export const topicParams = (slug: string) => (getVisibleCourse(slug)?.topics ?? []).map((topic) => ({ topic: topic.slug }));

export async function resolveTopic(slug: string, params: TopicParams["params"]) {
  const course = getVisibleCourse(slug);
  const { topic: topicSlug } = await params;
  const topic = course?.topics.find((entry) => entry.slug === topicSlug);
  return course && topic ? { course, topic } : undefined;
}
