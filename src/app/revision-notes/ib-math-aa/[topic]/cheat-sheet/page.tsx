import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheatSheet } from "@/components/course-notes/CheatSheet";
import { getVisibleCourse } from "@/lib/course-notes/course";
import { cheatSheetMeta } from "@/lib/course-notes/seo";

type Props = { params: Promise<{ topic: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return (getVisibleCourse()?.topics ?? []).map((topic) => ({ topic: topic.slug }));
}

const resolve = async (params: Props["params"]) => {
  const course = getVisibleCourse();
  const { topic: topicSlug } = await params;
  const topic = course?.topics.find((entry) => entry.slug === topicSlug);
  return course && topic ? { course, topic } : undefined;
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
