import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheatSheet } from "@/components/course-notes/CheatSheet";
import { COURSES, getCourse, isCourseVisible } from "@/lib/course-notes/course";
import { cheatSheetMeta } from "@/lib/course-notes/seo";

type Props = { params: Promise<{ subject: string; topic: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return COURSES.filter(isCourseVisible).flatMap((course) => course.topics.map((topic) => ({ subject: course.slug, topic: topic.slug })));
}

const resolve = async (params: Props["params"]) => {
  const { subject, topic } = await params;
  const course = getCourse(subject);
  if (!course || !isCourseVisible(course)) return undefined;
  const found = course.topics.find((entry) => entry.slug === topic);
  return found ? { course, topic: found } : undefined;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const hit = await resolve(params);
  return hit ? cheatSheetMeta(hit.course, hit.topic) : {};
}

export default async function CourseTopicCheatSheetPage({ params }: Props) {
  const hit = await resolve(params);
  if (!hit) notFound();
  return <CheatSheet course={hit.course} topic={hit.topic} />;
}
