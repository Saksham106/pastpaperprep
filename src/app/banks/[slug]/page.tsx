import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BankQuestionExplorer } from "@/components/BankQuestionExplorer";
import { BankSeoContent } from "@/components/BankSeoContent";
import { Testimonial } from "@/components/Testimonial";
import { bankTestimonial } from "@/lib/testimonials";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { loadBankExplorer } from "@/lib/bank-explorer";
import { getAvailableBanks, getBank, type BankSlug } from "@/lib/banks";
import { getCatalogBanksForDisplay } from "@/lib/catalog";
import { getLandingManifest, topicPath } from "@/lib/search-landing";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_URL } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return getAvailableBanks().map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const bank = getBank((await params).slug);
  if (!bank) return {};
  const path = `/banks/${bank.slug}`;
  const title = `${bank.shortName} Past Papers by Topic`;
  const description = `Practise ${bank.title} past-paper questions by topic, year, paper, marks, and more. Check answers and build focused revision sets.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | PastPaperPrep`,
      description,
      url: path,
      type: "website",
      images: [SOCIAL_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE_URL] },
  };
}

export default async function BankPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug as BankSlug;
  const bank = getBank(slug);
  if (!bank) notFound();
  const explorer = await loadBankExplorer(slug);
  if (!explorer) notFound();
  const topicLinks = getCatalogBanksForDisplay().some((entry) => entry.slug === slug)
    ? (await getLandingManifest(slug)).topics.map((topic) => ({ label: topic.label, href: topicPath(slug, topic) }))
    : [];

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            "@id": `https://pastpaperprep.com/banks/${bank.slug}#page`,
            url: `https://pastpaperprep.com/banks/${bank.slug}`,
            name: `${bank.shortName} Past Papers by Topic`,
            description: bank.description,
            isPartOf: { "@id": "https://pastpaperprep.com/#website" },
            about: {
              "@type": "Course",
              name: bank.title,
              educationalLevel: bank.qualification,
            },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "PastPaperPrep", item: "https://pastpaperprep.com/" },
              { "@type": "ListItem", position: 2, name: bank.shortName, item: `https://pastpaperprep.com/banks/${bank.slug}` },
            ],
          },
        ],
      }} />
      <section className={`bank-hero ${bank.accent}`}>
        <div className="shell">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: bank.shortName }]} />
          <p className="eyebrow">{bank.qualification}</p>
          <h1>{bank.title}</h1>
          <p>{bank.description}</p>
          {slug === "ib-hl" ? <p>Select real AA HL questions by topic and turn them into a printable practice set with eligible bank access. <Link href="#bank-guide-heading">See worksheet and PDF options</Link>.</p> : null}
          <Testimonial testimonial={bankTestimonial(slug)} variant="inline" signedOutOnly />
          <div className="bank-hero-meta"><div className="bank-hero-stats"><span><strong>{bank.questionCount.toLocaleString()}</strong> questions</span><span><strong>{bank.paperCount}</strong> papers</span><span><strong>{bank.years}</strong> coverage</span></div><Link className="button secondary bank-hero-build" href={`/worksheets/build?bank=${slug}`}>Build a paper</Link></div>
        </div>
      </section>
      <div className="shell">
        <BankQuestionExplorer slug={slug} explorer={explorer} />
        <BankSeoContent bank={bank} topicLinks={topicLinks} />
      </div>
    </>
  );
}
