// The glossary, /revision-notes/<course>/glossary.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVisibleCourse } from "@/lib/course-notes/course";
import { glossaryMeta } from "@/lib/course-notes/seo";
import { GlossaryIndex } from "../GlossaryIndex";
import { singleParams, withCourse } from "./shared";

export function courseGlossaryRoute(slug: string) {
  return {
    generateStaticParams: () => singleParams(slug),
    async generateMetadata(): Promise<Metadata> {
      const course = getVisibleCourse(slug);
      return course ? glossaryMeta(course) : {};
    },
    async Page() {
      const course = getVisibleCourse(slug);
      if (!course) notFound();
      return withCourse(course, <GlossaryIndex course={course} />);
    },
  };
}
