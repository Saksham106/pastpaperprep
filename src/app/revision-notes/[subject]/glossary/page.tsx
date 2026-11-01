import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GlossaryIndex } from "@/components/course-notes/GlossaryIndex";
import { COURSES, getCourse, isCourseVisible } from "@/lib/course-notes/course";
import { glossaryMeta } from "@/lib/course-notes/seo";

type Props = { params: Promise<{ subject: string }> };

// Course-only segment: with course-only params and dynamicParams = false, 0620 gets a 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return COURSES.filter(isCourseVisible).map(({ slug }) => ({ subject: slug }));
}

const visible = async (params: Props["params"]) => {
  const course = getCourse((await params).subject);
  return course && isCourseVisible(course) ? course : undefined;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await visible(params);
  return course ? glossaryMeta(course) : {};
}

export default async function CourseGlossaryPage({ params }: Props) {
  const course = await visible(params);
  if (!course) notFound();
  return <GlossaryIndex course={course} />;
}
