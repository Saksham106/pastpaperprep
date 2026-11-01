import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RevisionNotesTopic } from "@/components/RevisionNotes";
import { getNoteTopic, getNotesSubject, NOTES_SUBJECTS } from "@/lib/revision-notes";
import { getLandingManifest, topicPath } from "@/lib/search-landing";
import { resolveSubject } from "@/lib/past-paper-pages";
import { getGradeThresholds } from "@/lib/grade-thresholds";
import type { BankSlug } from "@/lib/catalog";
import { socialPreview } from "@/lib/seo";
import { CourseTopic } from "@/components/course-notes/CourseTopic";
import { COURSES, getCourse, isCourseVisible } from "@/lib/course-notes/course";
import { topicMeta } from "@/lib/course-notes/seo";

const visibleCourse = (slug: string) => {
  const course = getCourse(slug);
  return course && isCourseVisible(course) ? course : undefined;
};

export const dynamicParams = false;
export function generateStaticParams() {
  return [
    ...NOTES_SUBJECTS.flatMap((subject) => subject.topics.map((topic) => ({ subject: subject.subjectSlug, topic: topic.slug }))),
    ...COURSES.filter(isCourseVisible).flatMap((course) => course.topics.map((topic) => ({ subject: course.slug, topic: topic.slug }))),
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ subject: string; topic: string }> }): Promise<Metadata> {
  const { subject: subjectSlug, topic: topicSlug } = await params;
  const course = visibleCourse(subjectSlug);
  const courseTopic = course?.topics.find((entry) => entry.slug === topicSlug);
  if (course && courseTopic) return topicMeta(course, courseTopic);
  const topic = getNoteTopic(subjectSlug, topicSlug);
  if (!topic) return {};
  const path = `/revision-notes/${subjectSlug}/${topic.slug}`;
  return {
    title: { absolute: topic.title },
    description: topic.description,
    alternates: { canonical: path },
    openGraph: { url: path, type: "article", ...socialPreview() },
  };
}

export default async function RevisionNotesTopicPage({ params }: { params: Promise<{ subject: string; topic: string }> }) {
  const { subject: subjectSlug, topic: topicSlug } = await params;
  const course = visibleCourse(subjectSlug);
  if (course) {
    const courseTopic = course.topics.find((entry) => entry.slug === topicSlug);
    if (!courseTopic) notFound();
    return <CourseTopic course={course} topic={courseTopic} />;
  }
  const subject = getNotesSubject(subjectSlug);
  const topic = getNoteTopic(subjectSlug, topicSlug);
  if (!subject || !topic) notFound();
  // Prefer the indexable topic landing page; fall back to the filtered bank.
  const landing = (await getLandingManifest(subject.bankSlug as BankSlug)).topics.find((entry) => entry.slug === topic.slug);
  const practiceHref = landing ? topicPath(subject.bankSlug, landing) : `/banks/${subject.bankSlug}?topic=${encodeURIComponent(topic.topic)}`;
  const papers = await resolveSubject(subject.subjectSlug);
  return (
    <RevisionNotesTopic
      subject={subject}
      topic={topic}
      links={{
        practiceHref,
        papersHref: papers ? `/past-papers/${subject.subjectSlug}` : undefined,
        thresholdsHref: getGradeThresholds(subject.subjectSlug) ? `/grade-thresholds/${subject.subjectSlug}` : undefined,
      }}
    />
  );
}
