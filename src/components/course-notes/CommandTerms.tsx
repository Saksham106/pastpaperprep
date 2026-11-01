import type { Course } from "@/lib/course-notes/course";

export function CommandTerms({ course }: { course: Course }) {
  return (
    <main>
      <h1>{course.name} command terms</h1>
      <ul>
        {course.commandTerms.map((term) => (
          <li key={term.id}><b>{term.term}</b> {term.definition}</li>
        ))}
      </ul>
    </main>
  );
}
