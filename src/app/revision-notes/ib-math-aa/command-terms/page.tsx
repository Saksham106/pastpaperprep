import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandTerms } from "@/components/course-notes/CommandTerms";
import { COURSES, getVisibleCourse, isCourseVisible } from "@/lib/course-notes/course";
import { commandTermsMeta } from "@/lib/course-notes/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return COURSES.some(isCourseVisible) ? [{}] : [];
}

export async function generateMetadata(): Promise<Metadata> {
  const course = getVisibleCourse();
  return course ? commandTermsMeta(course) : {};
}

export default async function CourseCommandTermsPage() {
  const course = getVisibleCourse();
  if (!course) notFound();
  return <CommandTerms course={course} />;
}
