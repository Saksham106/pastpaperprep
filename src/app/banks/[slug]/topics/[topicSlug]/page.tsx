import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchDetail } from "@/components/SearchLanding";
import { getCatalogBank, getCatalogBanksForDisplay } from "@/lib/catalog";
import {
  getLandingManifest,
  topicFilterHref,
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
        title: `${topic.label} ${bank.shortName} past-paper questions`,
        description: `Practise ${topic.label} questions from the ${bank.shortName} PastPaperPrep archive.`,
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
  const topic = (await getLandingManifest(bank.slug)).topics.find(
    (item) => item.slug === topicSlug,
  );
  if (!topic) notFound();
  return (
    <SearchDetail
      bank={bank}
      title={`${topic.label}: ${bank.shortName} past-paper questions`}
      kind="topic"
      label={topic.label}
      count={topic.count}
      filterHref={topicFilterHref(bank.slug, topic.label)}
      canonicalPath={topicPath(bank.slug, topic)}
    />
  );
}
