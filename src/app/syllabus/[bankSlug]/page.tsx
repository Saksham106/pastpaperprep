import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SyllabusLanding } from "@/components/SearchLanding";
import {
  getCatalogBank,
  getCatalogBanksForDisplay,
  type BankSlug,
} from "@/lib/catalog";
import { getLandingManifest } from "@/lib/search-landing";
import { resolveSubject } from "@/lib/past-paper-pages";
import { subjectSlugForBank } from "@/lib/past-paper-catalog";
import { fitTitle, subjectSearchName } from "@/lib/past-paper-seo";
import { assessmentGuideFor } from "@/lib/assessment-guides";
export const dynamicParams = false;
export async function generateStaticParams() {
  return getCatalogBanksForDisplay().map((bank) => ({ bankSlug: bank.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ bankSlug: string }>;
}): Promise<Metadata> {
  const bank = getCatalogBank((await params).bankSlug);
  if (!bank) return {};
  // Titles use the name students search for ("IGCSE Physics 0625", "IB Biology HL"), not the internal short name.
  const name = subjectSearchName(bank);
  const { version } = assessmentGuideFor(bank);
  // "2025–2027 syllabus" reads as "syllabus 2025–2027"; "First assessment 2025" as "(first assessment 2025)".
  const edition = !/\d/.test(version) ? "" : version.endsWith(" syllabus") ? ` ${version.replace(/ syllabus$/, "")}` : ` (${version.charAt(0).toLowerCase()}${version.slice(1)})`;
  const description = [
    `${name} syllabus${edition} in plain English: every topic, each paper's timing and marks, and real past-paper questions by topic.`,
    `${name} syllabus${edition}: every topic, each paper's timing and marks, and past-paper questions by topic.`,
  ].find((text) => text.length <= 160) ?? `${name} syllabus: topics, papers and past-paper questions by topic.`;
  return {
    title: { absolute: fitTitle(`${name} Syllabus: Topics, Papers and Marks`, `${name} Syllabus: Topics and Papers`, `${name} Syllabus`) },
    description,
    alternates: { canonical: `/syllabus/${bank.slug}` },
    openGraph: { url: `/syllabus/${bank.slug}` },
  };
}
export default async function SyllabusPage({
  params,
}: {
  params: Promise<{ bankSlug: string }>;
}) {
  const slug = (await params).bankSlug as BankSlug;
  const bank = getCatalogBank(slug);
  if (
    !bank ||
    !getCatalogBanksForDisplay().some((entry) => entry.slug === slug)
  )
    notFound();
  const subject = subjectSlugForBank(slug);
  const fullPapersHref = (await resolveSubject(subject)) ? `/past-papers/${subject}` : undefined;
  return (
    <SyllabusLanding bank={bank} manifest={await getLandingManifest(slug)} fullPapersHref={fullPapersHref} />
  );
}
