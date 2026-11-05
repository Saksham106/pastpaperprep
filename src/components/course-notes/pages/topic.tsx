// A topic page, /revision-notes/<course>/<topic>.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { topicMeta } from "@/lib/course-notes/seo";
import { CourseTopic } from "../CourseTopic";
import { resolveTopic, topicParams, withCourse, type TopicParams } from "./shared";

export function courseTopicRoute(slug: string) {
  return {
    generateStaticParams: () => topicParams(slug),
    async generateMetadata({ params }: TopicParams): Promise<Metadata> {
      const hit = await resolveTopic(slug, params);
      return hit ? topicMeta(hit.course, hit.topic) : {};
    },
    async Page({ params }: TopicParams) {
      const hit = await resolveTopic(slug, params);
      if (!hit) notFound();
      return withCourse(hit.course, <CourseTopic course={hit.course} topic={hit.topic} />);
    },
  };
}
