import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GlossaryIndex } from "@/components/course-notes/GlossaryIndex";
import { COURSES, getVisibleCourse, isCourseVisible } from "@/lib/course-notes/course";
import { glossaryMeta } from "@/lib/course-notes/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return COURSES.some(isCourseVisible) ? [{}] : [];
}

export async function generateMetadata(): Promise<Metadata> {
  const course = getVisibleCourse();
  return course ? glossaryMeta(course) : {};
}

export default async function CourseGlossaryPage() {
  const course = getVisibleCourse();
  if (!course) notFound();
  return <GlossaryIndex course={course} />;
}
