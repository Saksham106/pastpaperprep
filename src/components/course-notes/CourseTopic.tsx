import itemsJson from "@/data/aa-official-subtopics/items.json";
import taxonomyJson from "@/data/aa-official-subtopics/taxonomy.json";
import { lessonPath, topicPath, type Course } from "@/lib/course-notes/course";
import { groupPracticeHref, groupQuestionCounts } from "@/lib/course-notes/practice";
import { CourseTopicView, type TopicStage } from "./CourseTopicView";

type SyllabusItem = { item: string; topic: number; level: "SL" | "AHL"; name: string };
type Group = { id: string; studentFacingName: string; parentTopic: string; memberOfficialItems: string[]; applicability: string[]; teachingOrder: number };

const ITEMS = new Map((itemsJson.items as SyllabusItem[]).map((entry) => [entry.item, entry]));

/** Stages for one topic: its taxonomy groups in teaching order, every syllabus item included. */
export function topicStages(course: Course, topic: Course["topics"][number]): TopicStage[] {
  const lessons = new Map(course.lessons.map((lesson) => [lesson.item, lesson]));
  return (taxonomyJson.groups as Group[])
    .filter((group) => group.parentTopic === topic.name)
    .sort((a, b) => a.teachingOrder - b.teachingOrder)
    .map((group) => ({
      id: group.id,
      name: group.studentFacingName,
      hlOnly: !group.applicability.includes("SL"),
      counts: groupQuestionCounts(group.id),
      hrefs: { SL: groupPracticeHref(group.id, "SL"), HL: groupPracticeHref(group.id, "HL") },
      lessons: group.memberOfficialItems.flatMap((id) => {
        const entry = ITEMS.get(id);
        if (!entry) return [];
        const lesson = lessons.get(id);
        return [{ item: entry.item, name: lesson?.title ?? entry.name, level: entry.level, ...(lesson ? { href: lessonPath(course, lesson), summary: lesson.summary } : {}) }];
      }),
    }));
}

export function CourseTopic({ course, topic }: { course: Course; topic: Course["topics"][number] }) {
  const stages = topicStages(course, topic);
  // Sum of the groups' counts, so the header agrees with the numbers under each stage.
  const questionTotals = { SL: 0, HL: 0 };
  for (const stage of stages) {
    if (!stage.hlOnly) questionTotals.SL += stage.counts.SL;
    questionTotals.HL += stage.counts.HL;
  }
  return (
    <CourseTopicView
      topic={{ n: topic.n, name: topic.name, cheatSheetHref: `${topicPath(course, topic.n)}/cheat-sheet`, questionTotals }}
      courseHref={`/revision-notes/${course.slug}`}
      stages={stages}
    />
  );
}
