// The course home, /revision-notes/<course>. Route files under src/app/revision-notes/<course>/ re-export this.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { getVisibleCourse } from "@/lib/course-notes/course";
import { SITE_URL, homeMeta } from "@/lib/course-notes/seo";
import { CourseHome } from "../CourseHome";
import { singleParams, withCourse } from "./shared";

export function courseHomeRoute(slug: string) {
  return {
    generateStaticParams: () => singleParams(slug),
    async generateMetadata(): Promise<Metadata> {
      const course = getVisibleCourse(slug);
      return course ? homeMeta(course) : {};
    },
    async Page() {
      const course = getVisibleCourse(slug);
      if (!course) notFound();
      const url = `${SITE_URL}/revision-notes/${course.slug}`;
      return (
        <>
          <JsonLd data={{ "@context": "https://schema.org", "@type": "Course", name: `${course.name} course notes`, description: homeMeta(course).description, url, provider: { "@type": "Organization", name: "PastPaperPrep", url: SITE_URL }, hasPart: course.topics.map((topic) => ({ "@type": "LearningResource", name: topic.name, url: `${url}/${topic.slug}` })) }} />
          {withCourse(course, <CourseHome course={course} />)}
        </>
      );
    },
  };
}
