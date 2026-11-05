// The whole-course cheat sheet, /revision-notes/<course>/cheat-sheet, and one topic's, /revision-notes/<course>/<topic>/cheat-sheet.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVisibleCourse } from "@/lib/course-notes/course";
import { cheatSheetMeta } from "@/lib/course-notes/seo";
import { CheatSheet } from "../CheatSheet";
import { resolveTopic, singleParams, topicParams, withCourse, type TopicParams } from "./shared";

export function courseCheatSheetRoute(slug: string) {
  return {
    generateStaticParams: () => singleParams(slug),
    async generateMetadata(): Promise<Metadata> {
      const course = getVisibleCourse(slug);
      return course ? cheatSheetMeta(course) : {};
    },
    async Page() {
      const course = getVisibleCourse(slug);
      if (!course) notFound();
      return withCourse(course, <CheatSheet course={course} />);
    },
  };
}

export function courseTopicCheatSheetRoute(slug: string) {
  return {
    generateStaticParams: () => topicParams(slug),
    async generateMetadata({ params }: TopicParams): Promise<Metadata> {
      const hit = await resolveTopic(slug, params);
      return hit ? cheatSheetMeta(hit.course, hit.topic) : {};
    },
    async Page({ params }: TopicParams) {
      const hit = await resolveTopic(slug, params);
      if (!hit) notFound();
      return withCourse(hit.course, <CheatSheet course={hit.course} topic={hit.topic} />);
    },
  };
}
