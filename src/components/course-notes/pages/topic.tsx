// A topic page, /revision-notes/<course>/<topic>.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { coursePath, topicPath } from "@/lib/course-notes/course";
import { notesBreadcrumb, topicMeta } from "@/lib/course-notes/seo";
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
      const { course, topic } = hit;
      return <>
        <JsonLd data={notesBreadcrumb([{ name: `${course.name} notes`, path: coursePath(course) }, { name: topic.name, path: topicPath(course, topic.n) }])} />
        {withCourse(course, <CourseTopic course={course} topic={topic} />)}
      </>;
    },
  };
}
