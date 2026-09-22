import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SyllabusLanding } from "@/components/SearchLanding";
import {
  getCatalogBank,
  getCatalogBanksForDisplay,
  type BankSlug,
} from "@/lib/catalog";
import { getLandingManifest } from "@/lib/search-landing";
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
  return bank
    ? {
        title: `${bank.shortName} syllabus and practice`,
        description: `A plain-English ${bank.shortName} syllabus guide with archive coverage and focused past-paper practice.`,
        alternates: { canonical: `/syllabus/${bank.slug}` },
        openGraph: { url: `/syllabus/${bank.slug}` },
      }
    : {};
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
  return (
    <SyllabusLanding bank={bank} manifest={await getLandingManifest(slug)} />
  );
}
