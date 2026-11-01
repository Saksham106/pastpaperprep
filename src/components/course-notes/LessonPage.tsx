import { lessonPath, type Course } from "@/lib/course-notes/course";
import type { Lesson } from "@/lib/course-notes/types";
import { Blocks } from "./Blocks";

export function LessonPage({ course, lesson }: { course: Course; lesson: Lesson }) {
  const lessonHref = (item: string) => {
    const target = course.lessons.find((entry) => entry.item === item);
    return target ? lessonPath(course, target) : `/revision-notes/${course.slug}`;
  };
  return (
    <main>
      <h1>{lesson.title}</h1>
      <p>{lesson.summary}</p>
      {lesson.sections.map((section) => (
        <section key={section.id}>
          <h2>{section.heading}</h2>
          <Blocks blocks={section.blocks} glossary={course.glossary} level="HL" figures={course.figures} lessonHref={lessonHref} />
        </section>
      ))}
    </main>
  );
}
