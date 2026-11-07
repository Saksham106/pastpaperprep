import { topicPath, type Course } from "@/lib/course-notes/course";
import { topicQuestionTotals, topicStages } from "@/lib/course-notes/practice";
import { CourseTopicView } from "./CourseTopicView";

export function CourseTopic({ course, topic }: { course: Course; topic: Course["topics"][number] }) {
  return (
    <CourseTopicView
      topic={{ n: topic.n, name: topic.name, ...(topic.label ? { label: topic.label } : {}), cheatSheetHref: `${topicPath(course, topic.n)}/cheat-sheet`, questionTotals: topicQuestionTotals(course, topic) }}
      courseHref={`/revision-notes/${course.slug}`}
      stages={topicStages(course, topic)}
    />
  );
}
