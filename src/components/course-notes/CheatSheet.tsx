import Link from "next/link";
import { lessonPath, lessonsForTopic, type Course } from "@/lib/course-notes/course";

/** `topic` limits the sheet to one topic; omitted means the whole course. */
export function CheatSheet({ course, topic }: { course: Course; topic?: Course["topics"][number] }) {
  const lessons = topic ? lessonsForTopic(course, topic.n) : course.lessons;
  return (
    <main>
      <h1>{topic ? `${topic.name} cheat sheet` : `${course.name} cheat sheet`}</h1>
      <ul>
        {lessons.map((lesson) => (
          <li key={lesson.item}><Link href={lessonPath(course, lesson)}>{lesson.item} {lesson.title}</Link></li>
        ))}
      </ul>
    </main>
  );
}
