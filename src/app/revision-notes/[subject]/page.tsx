import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RevisionNotesIndex } from "@/components/RevisionNotes";
import { getNotesSubject, NOTES_SUBJECTS } from "@/lib/revision-notes";
import { resolveSubject } from "@/lib/past-paper-pages";
import { getGradeThresholds } from "@/lib/grade-thresholds";

export const dynamicParams = false;
export function generateStaticParams() {
  return NOTES_SUBJECTS.map(({ subjectSlug }) => ({ subject: subjectSlug }));
}

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }): Promise<Metadata> {
  const subject = getNotesSubject((await params).subject);
  if (!subject) return {};
  const path = `/revision-notes/${subject.subjectSlug}`;
  return {
    title: { absolute: `${subject.name} Revision Notes: All ${subject.topics.length} Topics` },
    description: `Free ${subject.name} revision notes for every syllabus topic, with Extended content marked, exam tips and links to real past-paper questions.`,
    alternates: { canonical: path },
    openGraph: { url: path, type: "website" },
  };
}

export default async function RevisionNotesSubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const subject = getNotesSubject((await params).subject);
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
