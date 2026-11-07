// Test-only helper. Never import from production code.
// Visibility is read from two places: the registry course (copied from course.json at import) and the course.json
// object itself (read by the site-chrome helpers in visibility.ts). Tests that check the hidden state force both.
import { COURSES, type Course } from "./course";
import type { Lesson } from "./types";
import { COURSE_FLAGS } from "./visibility";

/** Force a course's published flag (default AA) in both places. Returns a function that restores the previous values. */
export function setCoursePublishedForTests(published: boolean, slug = "ib-math-aa"): () => void {
  const course = COURSES.find((entry) => entry.slug === slug) as { published: boolean } | undefined;
  const json = COURSE_FLAGS.find((entry) => entry.slug === slug) as { published: boolean } | undefined;
  if (!course || !json) throw new Error(`Unknown course ${slug}`);
  const previous = { course: course.published, json: json.published };
  course.published = published;
  json.published = published;
  return () => {
    course.published = previous.course;
    json.published = previous.json;
  };
}

/**
 * Stand-in lessons for a course's items (default every item), for testing links before a course's lessons are written.
 * Each copies `template` with the item's number, topic, level and name. Returns a function that restores the real lessons.
 */
export function setCourseLessonsForTests(slug: string, template: Lesson, items?: readonly string[]): () => void {
  const course = COURSES.find((entry) => entry.slug === slug) as { lessons: Lesson[]; items: Course["items"] } | undefined;
  if (!course) throw new Error(`Unknown course ${slug}`);
  const previous = course.lessons;
  const picked = course.items.items.filter((entry) => !items || items.includes(entry.item));
  course.lessons = picked.map((entry) => ({ ...template, edition: course.items.edition, item: entry.item, topic: entry.topic, level: entry.level, title: entry.name, slug: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }));
  return () => {
    course.lessons = previous;
  };
}
