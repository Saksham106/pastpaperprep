import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RevisionNotesIndex } from "@/components/RevisionNotes";
import { getNotesSubject, NOTES_SUBJECTS } from "@/lib/revision-notes";
import { resolveSubject } from "@/lib/past-paper-pages";
import { getGradeThresholds } from "@/lib/grade-thresholds";
import { socialPreview } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { CourseHome } from "@/components/course-notes/CourseHome";
import { COURSES, getCourse, isCourseVisible } from "@/lib/course-notes/course";
import { SITE_URL, homeMeta } from "@/lib/course-notes/seo";

const visibleCourse = (slug: string) => {
  const course = getCourse(slug);
  return course && isCourseVisible(course) ? course : undefined;
};

export const dynamicParams = false;
export function generateStaticParams() {
  return [
    ...NOTES_SUBJECTS.map(({ subjectSlug }) => ({ subject: subjectSlug })),
    ...COURSES.filter(isCourseVisible).map(({ slug }) => ({ subject: slug })),
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }): Promise<Metadata> {
  const slug = (await params).subject;
  const course = visibleCourse(slug);
  if (course) return homeMeta(course);
  const subject = getNotesSubject(slug);
  if (!subject) return {};
  const path = `/revision-notes/${subject.subjectSlug}`;
  return {
    title: { absolute: `${subject.name} Revision Notes: All ${subject.topics.length} Topics` },
    description: `Free ${subject.name} revision notes for every syllabus topic, with Extended content marked, exam tips and links to real past-paper questions.`,
    alternates: { canonical: path },
    openGraph: { url: path, type: "website", ...socialPreview() },
  };
}

export default async function RevisionNotesSubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const slug = (await params).subject;
  const course = visibleCourse(slug);
  if (course) {
    const url = `${SITE_URL}/revision-notes/${course.slug}`;
    return (
      <>
        <JsonLd data={{ "@context": "https://schema.org", "@type": "Course", name: `${course.name} course notes`, url, provider: { "@type": "Organization", name: "PastPaperPrep", url: SITE_URL }, hasPart: course.topics.map((topic) => ({ "@type": "LearningResource", name: topic.name, url: `${url}/${topic.slug}` })) }} />
        <CourseHome course={course} />
      </>
    );
  }
  const subject = getNotesSubject(slug);
  if (!subject) notFound();
  const papers = await resolveSubject(subject.subjectSlug);
  return (
    <RevisionNotesIndex
      subject={subject}
      papersHref={papers ? `/past-papers/${subject.subjectSlug}` : undefined}
      thresholdsHref={getGradeThresholds(subject.subjectSlug) ? `/grade-thresholds/${subject.subjectSlug}` : undefined}
    />
  );
}
