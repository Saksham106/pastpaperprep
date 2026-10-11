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
  topicPath,
} from "@/lib/search-landing";
export const dynamicParams = false;
export async function generateStaticParams() {
  const out: Array<{ slug: string; topicSlug: string }> = [];
  for (const bank of getCatalogBanksForDisplay())
    for (const topic of (await getLandingManifest(bank.slug)).topics)
      out.push({ slug: bank.slug, topicSlug: topic.slug });
  return out;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; topicSlug: string }>;
}): Promise<Metadata> {
  const { slug, topicSlug } = await params;
  const bank = getCatalogBank(slug);
  const topic = bank
    ? (await getLandingManifest(bank.slug)).topics.find(
        (item) => item.slug === topicSlug,
      )
    : undefined;
  return bank && topic
    ? {
        title: `${topic.label} Past Paper Questions – ${bankSearchName(bank)}`,
        description: `Practise ${topic.count.toLocaleString()} ${bankSearchName(bank)} ${topic.label} past-paper questions from ${bank.years}. Start with the free questions, check answers, and build a worksheet.`,
        alternates: { canonical: topicPath(bank.slug, topic) },
        openGraph: { url: topicPath(bank.slug, topic) },
      }
    : {};
}
export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string; topicSlug: string }>;
}) {
  const { slug, topicSlug } = await params;
  const bank = getCatalogBank(slug);
  if (
    !bank ||
    !getCatalogBanksForDisplay().some((entry) => entry.slug === slug)
  )
    notFound();
  const manifest = await getLandingManifest(bank.slug);
  const topic = manifest.topics.find((item) => item.slug === topicSlug);
  if (!topic) notFound();
  const routePreset = { topic: topic.label };
  const explorer = await loadBankExplorer(bank.slug, routePreset);
  if (!explorer) notFound();
  return (
    <SearchDetail
      bank={bank}
      eyebrow={`${bankSearchName(bank)} · Topic practice`}
      title={`${topic.label} past paper questions`}
      kind="topic"
      label={topic.label}
      canonicalPath={topicPath(bank.slug, topic)}
      stats={landingDetailStats(bank.slug, explorer.routeMatches, "topic")}
      related={manifest.topics
        .filter((item) => item.slug !== topic.slug)
        .map((item) => ({ label: item.label, href: topicPath(bank.slug, item), count: item.count }))}
    >
      <BankQuestionExplorer slug={bank.slug} explorer={explorer} routePreset={routePreset} />
    </SearchDetail>
  );
}
