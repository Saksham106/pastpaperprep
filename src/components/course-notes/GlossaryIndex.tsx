import Link from "next/link";
import { lessonPath, type Course } from "@/lib/course-notes/course";

export function GlossaryIndex({ course }: { course: Course }) {
  return (
    <main>
      <h1>{course.name} glossary</h1>
      <ul>
        {course.glossary.map((term) => {
          const lesson = course.lessons.find((entry) => entry.item === term.lesson);
          return (
            <li key={term.id}>
              {lesson ? <Link href={lessonPath(course, lesson)}>{term.term}</Link> : term.term}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
