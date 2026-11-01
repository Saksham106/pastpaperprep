import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheatSheet } from "@/components/course-notes/CheatSheet";
import { COURSES, getVisibleCourse, isCourseVisible } from "@/lib/course-notes/course";
import { cheatSheetMeta } from "@/lib/course-notes/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return COURSES.some(isCourseVisible) ? [{}] : [];
}

export async function generateMetadata(): Promise<Metadata> {
  const course = getVisibleCourse();
  return course ? cheatSheetMeta(course) : {};
}

export default async function CourseCheatSheetPage() {
  const course = getVisibleCourse();
  if (!course) notFound();
  return <CheatSheet course={course} />;
}
