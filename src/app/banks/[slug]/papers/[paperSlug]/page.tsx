import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BankQuestionExplorer } from "@/components/BankQuestionExplorer";
import { SearchDetail } from "@/components/SearchLanding";
import { loadBankExplorer } from "@/lib/bank-explorer";
import { getCatalogBank, getCatalogBanksForDisplay } from "@/lib/catalog";
import {
  bankSearchName,
  getLandingManifest,
  landingDetailStats,
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
        title: `${paper.label} Past Paper Questions – ${bankSearchName(bank)}`,
        description: `Practise ${paper.count.toLocaleString()} ${bankSearchName(bank)} ${paper.label} past-paper questions from ${bank.years}. Filter by topic and year, check answers, and build a worksheet.`,
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
  const manifest = await getLandingManifest(bank.slug);
  const paper = manifest.papers.find((item) => item.slug === paperSlug);
  if (!paper) notFound();
  const routePreset = { paper: String(paper.paper) };
  const explorer = await loadBankExplorer(bank.slug, routePreset);
  if (!explorer) notFound();
  return (
    <SearchDetail
      bank={bank}
      eyebrow={`${bankSearchName(bank)} · Paper practice`}
      title={`${paper.label} past paper questions`}
      kind="paper"
      label={paper.label}
      canonicalPath={paperPath(bank.slug, paper)}
      stats={landingDetailStats(bank.slug, explorer.routeMatches, "paper")}
      related={manifest.papers
        .filter((item) => item.slug !== paper.slug)
        .map((item) => ({ label: item.label, href: paperPath(bank.slug, item), count: item.count }))}
    >
      <BankQuestionExplorer slug={bank.slug} explorer={explorer} routePreset={routePreset} />
    </SearchDetail>
  );
}
