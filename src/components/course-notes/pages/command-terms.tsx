// The command terms, /revision-notes/<course>/command-terms.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVisibleCourse } from "@/lib/course-notes/course";
import { commandTermsMeta } from "@/lib/course-notes/seo";
import { CommandTerms } from "../CommandTerms";
import { singleParams, withCourse } from "./shared";

export function courseCommandTermsRoute(slug: string) {
  return {
    generateStaticParams: () => singleParams(slug),
    async generateMetadata(): Promise<Metadata> {
      const course = getVisibleCourse(slug);
      return course ? commandTermsMeta(course) : {};
    },
    async Page() {
      const course = getVisibleCourse(slug);
      if (!course) notFound();
      return withCourse(course, <CommandTerms course={course} />);
    },
  };
}
