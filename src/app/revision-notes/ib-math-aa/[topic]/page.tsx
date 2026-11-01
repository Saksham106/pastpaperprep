import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseTopic } from "@/components/course-notes/CourseTopic";
import { getVisibleCourse } from "@/lib/course-notes/course";
import { topicMeta } from "@/lib/course-notes/seo";

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
  return hit ? topicMeta(hit.course, hit.topic) : {};
}

export default async function CourseTopicPage({ params }: Props) {
  const hit = await resolve(params);
  if (!hit) notFound();
  return <CourseTopic course={hit.course} topic={hit.topic} />;
}
