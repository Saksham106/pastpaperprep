import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GradeThresholdsPage } from "@/components/GradeThresholds";
import { GRADE_THRESHOLDS, getGradeThresholds } from "@/lib/grade-thresholds";
import { bankForSubjectSlug } from "@/lib/past-paper-catalog";
import { getCatalogBank } from "@/lib/catalog";
import { subjectSearchName } from "@/lib/past-paper-seo";
import { resolveSubject } from "@/lib/past-paper-pages";
import { getNotesSubject } from "@/lib/revision-notes";

export const dynamicParams = false;
export function generateStaticParams() {
  return GRADE_THRESHOLDS.map(({ subjectSlug }) => ({ subject: subjectSlug }));
}

function subjectName(subjectSlug: string): string | null {
  const bankSlug = bankForSubjectSlug(subjectSlug);
  const bank = bankSlug ? getCatalogBank(bankSlug) : undefined;
  return bank ? subjectSearchName(bank) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ subject: string }> }): Promise<Metadata> {
  const { subject } = await params;
  const data = getGradeThresholds(subject);
  const name = subjectName(subject);
  if (!data || !name) return {};
  const years = data.tables.map((table) => Number(/\d{4}/.exec(table.series)?.[0])).filter(Boolean);
  const span = `${Math.min(...years)}–${Math.max(...years)}`;
  const path = `/grade-thresholds/${subject}`;
  return {
    title: { absolute: `${name} Grade Thresholds (${span})` },
    description: `${name} grade thresholds for every series from ${span}: the marks needed for A*, A, B and C, by option and paper. Latest: ${data.tables[0].series}.`,
    alternates: { canonical: path },
    openGraph: { url: path, type: "website" },
  };
}

export default async function GradeThresholdsSubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  const data = getGradeThresholds(subject);
  const name = subjectName(subject);
  if (!data || !name) notFound();
  const papers = await resolveSubject(subject);
  return (
    <GradeThresholdsPage
      data={data}
      name={name}
      papersHref={papers ? `/past-papers/${subject}` : undefined}
      paperYears={papers ? [...new Set(papers.papers.map((paper) => paper.year))] : undefined}
      notesHref={getNotesSubject(subject) ? `/revision-notes/${subject}` : undefined}
    />
  );
}
