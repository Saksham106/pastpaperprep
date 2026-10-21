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
import { getCatalogBank, getCatalogBanksForDisplay } from "@/lib/catalog";
import { resolveSubject } from "@/lib/past-paper-pages";
import { subjectSlugForBank } from "@/lib/past-paper-catalog";
import { fitTitle, pageTitle, subjectSearchName } from "@/lib/past-paper-seo";
import { bankSearchName, getLandingManifest, topicPath } from "@/lib/search-landing";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_URL } from "@/lib/seo";
import { hasPublishedExplanations } from "@/lib/explanations";
import { bankLastUpdated, formatUpdateDate } from "@/lib/updates";
import { bankFacts } from "@/lib/quick-facts";
import { QuickFacts } from "@/components/QuickFacts";
import { freeQuestionYears, hasFreeTier } from "@/lib/access";

export const dynamicParams = false;
export function generateStaticParams() { return getAvailableBanks().map(({ slug }) => ({ slug })); }

/** Topic practice and the full-paper library target different searches: "topical" here, whole papers under /past-papers. */
function topicalCopy(slug: BankSlug, fallbackName: string) {
  const catalog = getCatalogBank(slug);
  const name = catalog ? subjectSearchName(catalog) : fallbackName;
  return {
    name,
    // IB students search "question bank"; IGCSE students search "topical past papers".
    title: catalog?.qualification === "IB Diploma"
      ? fitTitle(`${name} Question Bank: Topical Past Papers`, `${name} Topical Past Papers`)
      : fitTitle(`${name} Topical Past Paper Questions`, `${name} Topical Past Papers`),
    description: hasPublishedExplanations(slug)
      ? `${name} topical past-paper questions by topic, year, paper and marks. Official answers plus selected worked explanations where published.`
      : `${name} topical past-paper questions: real exams sorted by topic, year, paper and marks, with official answers.`,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const bank = getBank((await params).slug);
  if (!bank) return {};
  const path = `/banks/${bank.slug}`;
  const { title, description } = topicalCopy(bank.slug, bank.shortName);
  return {
    title: pageTitle(title),
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
  const topical = topicalCopy(slug, bank.shortName);
  const updated = bankLastUpdated(slug);
  const fullPapers = await resolveSubject(subjectSlugForBank(slug));
  const catalogBank = getCatalogBanksForDisplay().find((entry) => entry.slug === slug);
  const manifest = catalogBank ? await getLandingManifest(slug) : undefined;
  const topicLinks = manifest ? manifest.topics.map((topic) => ({ label: topic.label, href: topicPath(slug, topic) })) : [];
  const facts = catalogBank && manifest ? bankFacts({
    bankName: bankSearchName(catalogBank),
    total: manifest.questionCount,
    papers: manifest.paperCount,
    years: manifest.years,
    topics: manifest.syllabusTopics.length ? manifest.syllabusTopics : manifest.topics,
    freeYears: hasFreeTier(slug) ? freeQuestionYears(slug) : undefined,
    explanations: hasPublishedExplanations(slug),
  }) : [];

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            "@id": `https://pastpaperprep.com/banks/${bank.slug}#page`,
            url: `https://pastpaperprep.com/banks/${bank.slug}`,
            name: topical.title,
            description: topical.description,
            ...(updated ? { dateModified: updated } : {}),
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
          <h1>{topical.name}: questions by topic</h1>
          <div className="bank-hero-meta">
            <p className="bank-hero-stats"><span><strong>{bank.questionCount.toLocaleString()}</strong> questions</span><span><strong>{bank.paperCount}</strong> papers</span><span><strong>{bank.years}</strong></span>{updated ? <span>Updated <time dateTime={updated}>{formatUpdateDate(updated)}</time></span> : null}</p>
            <div className="bank-hero-actions">
              {fullPapers ? <Link className="button secondary" href={`/past-papers/${subjectSlugForBank(slug)}`}>Full past papers</Link> : null}
              <Link className="button secondary bank-hero-build" href={`/worksheets/build?bank=${slug}`}>Build a paper</Link>
            </div>
          </div>
          <Testimonial testimonial={bankTestimonial(slug)} variant="inline" signedOutOnly />
        </div>
      </section>
      <div className="shell">
        <BankQuestionExplorer slug={slug} explorer={explorer} />
        <BankSeoContent bank={bank} topicLinks={topicLinks} />
        <QuickFacts id="bank-facts-heading" title={`${bank.shortName}: quick facts`} facts={facts} />
      </div>
    </>
  );
}
