import Link from "next/link";
import { topicPath, type Course } from "@/lib/course-notes/course";

export function CourseHome({ course }: { course: Course }) {
  const base = `/revision-notes/${course.slug}`;
  return (
    <main>
      <h1>{course.name} course notes</h1>
      <ul>
        {course.topics.map((topic) => (
          <li key={topic.n}><Link href={topicPath(course, topic.n)}>{topic.name}</Link></li>
        ))}
        <li><Link href={`${base}/cheat-sheet`}>Cheat sheet</Link></li>
        <li><Link href={`${base}/glossary`}>Glossary</Link></li>
        <li><Link href={`${base}/command-terms`}>Command terms</Link></li>
      </ul>
    </main>
  );
}
