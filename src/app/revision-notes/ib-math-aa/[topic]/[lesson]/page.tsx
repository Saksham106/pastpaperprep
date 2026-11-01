import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { LessonPage } from "@/components/course-notes/LessonPage";
import { getVisibleCourse, lessonPath } from "@/lib/course-notes/course";
import { SITE_URL, lessonMeta } from "@/lib/course-notes/seo";

type Props = { params: Promise<{ topic: string; lesson: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  const course = getVisibleCourse();
  return (course?.lessons ?? []).map((lesson) => {
    const [, , , topic, slug] = lessonPath(course!, lesson).split("/");
    return { topic, lesson: slug };
  });
}

const resolve = async (params: Props["params"]) => {
  const course = getVisibleCourse();
  if (!course) return undefined;
  const { topic, lesson } = await params;
  const found = course.lessons.find((entry) => lessonPath(course, entry) === `/revision-notes/${course.slug}/${topic}/${lesson}`);
  return found ? { course, lesson: found } : undefined;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const hit = await resolve(params);
  return hit ? lessonMeta(hit.course, hit.lesson) : {};
}

export default async function CourseLessonPage({ params }: Props) {
  const hit = await resolve(params);
  if (!hit) notFound();
  const { course, lesson } = hit;
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "LearningResource", name: lesson.title, description: lesson.summary, url: `${SITE_URL}${lessonPath(course, lesson)}`, educationalLevel: "IB Diploma", learningResourceType: "Course notes", timeRequired: `PT${lesson.readingMinutes}M`, author: { "@type": "Organization", name: "PastPaperPrep" } }} />
      <LessonPage course={course} lesson={lesson} />
    </>
  );
}
