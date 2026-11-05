// Test-only helper. Never import from production code.
// Visibility is read from two places: the registry course (copied from course.json at import) and the course.json
// object itself (read by the site-chrome helpers in visibility.ts). Tests that check the hidden state force both.
import { COURSES } from "./course";
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
