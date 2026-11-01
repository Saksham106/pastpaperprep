import itemsJson from "@/data/aa-official-subtopics/items.json";
import { lessonPath, type Course } from "@/lib/course-notes/course";
import { compareItems } from "@/lib/course-notes/items";
import { CourseHomeView } from "./CourseHomeView";
import type { HomeItem } from "./LessonSearch";

type SyllabusItem = { item: string; topic: number; level: "SL" | "AHL"; name: string };

/** All syllabus items in order. Written lessons link; the rest render as "Not written yet" (preview only). */
export function homeItems(course: Course): HomeItem[] {
  const lessons = new Map(course.lessons.map((lesson) => [lesson.item, lesson]));
  return (itemsJson.items as SyllabusItem[])
    .map((entry) => {
      const lesson = lessons.get(entry.item);
      return {
        item: entry.item,
        topic: entry.topic,
        level: entry.level,
        name: entry.name,
        ...(lesson ? { href: lessonPath(course, lesson), synonyms: lesson.synonyms } : {}),
      };
    })
    .sort((a, b) => a.topic - b.topic || compareItems(a.item, b.item));
}

export function CourseHome({ course }: { course: Course }) {
  const base = `/revision-notes/${course.slug}`;
  return (
    <CourseHomeView
      name={course.name}
      base={base}
      topics={course.topics.map((topic) => ({ n: topic.n, name: topic.name, href: `${base}/${topic.slug}`, cheatSheetHref: `${base}/${topic.slug}/cheat-sheet` }))}
      items={homeItems(course)}
    />
  );
}
