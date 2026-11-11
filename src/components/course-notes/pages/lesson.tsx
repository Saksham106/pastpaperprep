// A lesson page, /revision-notes/<course>/<topic>/<item>-<slug>.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { getVisibleCourse, lessonPath } from "@/lib/course-notes/course";
import { inlineToPlainText } from "@/lib/course-notes/plain-text";
import { SITE_URL, lessonMeta } from "@/lib/course-notes/seo";
import { LessonPage } from "../LessonPage";
import { withCourse, type LessonParams } from "./shared";

async function resolveLesson(slug: string, params: LessonParams["params"]) {
  const course = getVisibleCourse(slug);
  if (!course) return undefined;
  const { topic, lesson } = await params;
  const found = course.lessons.find((entry) => lessonPath(course, entry) === `/revision-notes/${course.slug}/${topic}/${lesson}`);
  return found ? { course, lesson: found } : undefined;
}

export function courseLessonRoute(slug: string) {
  return {
    generateStaticParams() {
      const course = getVisibleCourse(slug);
      return (course?.lessons ?? []).map((lesson) => {
        const [, , , topic, lessonSlug] = lessonPath(course!, lesson).split("/");
        return { topic, lesson: lessonSlug };
      });
    },
    async generateMetadata({ params }: LessonParams): Promise<Metadata> {
      const hit = await resolveLesson(slug, params);
      return hit ? lessonMeta(hit.course, hit.lesson) : {};
    },
    async Page({ params }: LessonParams) {
      const hit = await resolveLesson(slug, params);
      if (!hit) notFound();
      const { course, lesson } = hit;
      return (
        <>
          <JsonLd data={{ "@context": "https://schema.org", "@type": "LearningResource", name: lesson.title, description: inlineToPlainText(lesson.summary), url: `${SITE_URL}${lessonPath(course, lesson)}`, educationalLevel: course.copy.educationalLevel, learningResourceType: "Course notes", timeRequired: `PT${lesson.readingMinutes}M`, author: { "@type": "Organization", name: "PastPaperPrep" } }} />
          {withCourse(course, <LessonPage course={course} lesson={lesson} />)}
        </>
      );
    },
  };
}
