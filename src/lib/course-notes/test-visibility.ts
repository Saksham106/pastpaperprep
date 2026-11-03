// Test-only helper. Never import from production code.
// Visibility is read from two places: `COURSES[0].published` (copied from course.json at import) and
// `courseJson.published` (read by `notesNavVisible()`). Tests that check the hidden state force both.
import courseJson from "@/content/notes/ib-math-aa/course.json";
import { COURSES } from "./course";

/** Force the AA course's published flag in both places. Returns a function that restores the previous values. */
export function setCoursePublishedForTests(published: boolean): () => void {
  const course = COURSES[0] as { published: boolean };
  const json = courseJson as { published: boolean };
  const previous = { course: course.published, json: json.published };
  course.published = published;
  json.published = published;
  return () => {
    course.published = previous.course;
    json.published = previous.json;
  };
}
