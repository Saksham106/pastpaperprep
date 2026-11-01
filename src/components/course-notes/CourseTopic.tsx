import Link from "next/link";
import { lessonPath, lessonsForTopic, type Course } from "@/lib/course-notes/course";

export function CourseTopic({ course, topic }: { course: Course; topic: Course["topics"][number] }) {
  return (
    <main>
      <h1>{topic.name}</h1>
      <ul>
        {lessonsForTopic(course, topic.n).map((lesson) => (
          <li key={lesson.item}><Link href={lessonPath(course, lesson)}>{lesson.item} {lesson.title}</Link></li>
        ))}
      </ul>
      <Link href={`/revision-notes/${course.slug}/${topic.slug}/cheat-sheet`}>Topic cheat sheet</Link>
    </main>
  );
}
