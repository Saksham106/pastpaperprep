import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { LessonPage } from "@/components/course-notes/LessonPage";
import { COURSES, getCourse, isCourseVisible, lessonPath } from "@/lib/course-notes/course";
import { SITE_URL, lessonMeta } from "@/lib/course-notes/seo";

type Props = { params: Promise<{ subject: string; topic: string; lesson: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return COURSES.filter(isCourseVisible).flatMap((course) =>
    course.lessons.map((lesson) => {
      const [, , , topic, slug] = lessonPath(course, lesson).split("/");
      return { subject: course.slug, topic, lesson: slug };
    }),
  );
}

const resolve = async (params: Props["params"]) => {
  const { subject, topic, lesson } = await params;
  const course = getCourse(subject);
  if (!course || !isCourseVisible(course)) return undefined;
  const found = course.lessons.find((entry) => lessonPath(course, entry) === `/revision-notes/${subject}/${topic}/${lesson}`);
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
