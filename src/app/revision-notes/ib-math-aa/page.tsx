import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { CourseHome } from "@/components/course-notes/CourseHome";
import { COURSES, getVisibleCourse, isCourseVisible } from "@/lib/course-notes/course";
import { SITE_URL, homeMeta } from "@/lib/course-notes/seo";

// Own static route tree: a static segment beats [subject], and keeps the course CSS off the IGCSE pages.
export const dynamicParams = false;
export function generateStaticParams() {
  return COURSES.some(isCourseVisible) ? [{}] : [];
}

export async function generateMetadata(): Promise<Metadata> {
  const course = getVisibleCourse();
  return course ? homeMeta(course) : {};
}

export default async function CourseHomePage() {
  const course = getVisibleCourse();
  if (!course) notFound();
  const url = `${SITE_URL}/revision-notes/${course.slug}`;
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Course", name: `${course.name} course notes`, description: homeMeta(course).description, url, provider: { "@type": "Organization", name: "PastPaperPrep", url: SITE_URL }, hasPart: course.topics.map((topic) => ({ "@type": "LearningResource", name: topic.name, url: `${url}/${topic.slug}` })) }} />
      <CourseHome course={course} />
    </>
  );
}
