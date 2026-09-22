import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchDetail } from "@/components/SearchLanding";
import { getCatalogBank, getCatalogBanksForDisplay } from "@/lib/catalog";
import {
  getLandingManifest,
  paperFilterHref,
  paperPath,
} from "@/lib/search-landing";
export const dynamicParams = false;
export async function generateStaticParams() {
  const out: Array<{ slug: string; paperSlug: string }> = [];
  for (const bank of getCatalogBanksForDisplay())
    for (const paper of (await getLandingManifest(bank.slug)).papers)
      out.push({ slug: bank.slug, paperSlug: paper.slug });
  return out;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; paperSlug: string }>;
}): Promise<Metadata> {
  const { slug, paperSlug } = await params;
  const bank = getCatalogBank(slug);
  const paper = bank
    ? (await getLandingManifest(bank.slug)).papers.find(
        (item) => item.slug === paperSlug,
      )
    : undefined;
  return bank && paper
    ? {
        title: `${paper.label} ${bank.shortName} past papers`,
        description: `Practise archive questions from ${paper.label} in the ${bank.shortName} PastPaperPrep bank.`,
        alternates: { canonical: paperPath(bank.slug, paper) },
        openGraph: { url: paperPath(bank.slug, paper) },
      }
    : {};
}
export default async function PaperPage({
  params,
}: {
  params: Promise<{ slug: string; paperSlug: string }>;
}) {
  const { slug, paperSlug } = await params;
  const bank = getCatalogBank(slug);
  if (
    !bank ||
    !getCatalogBanksForDisplay().some((entry) => entry.slug === slug)
  )
    notFound();
  const paper = (await getLandingManifest(bank.slug)).papers.find(
    (item) => item.slug === paperSlug,
  );
  if (!paper) notFound();
  return (
    <SearchDetail
      bank={bank}
      title={`${paper.label}: ${bank.shortName} past papers`}
      kind="paper"
      label={paper.label}
      count={paper.count}
      filterHref={paperFilterHref(bank.slug, paper.paper)}
      canonicalPath={paperPath(bank.slug, paper)}
    />
  );
}
