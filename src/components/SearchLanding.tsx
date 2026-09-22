import Link from "next/link";
import type { CatalogBank, Qualification } from "@/lib/catalog";
import { getCatalogBanksForDisplay } from "@/lib/catalog";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import {
  courseOverview,
  officialQualificationSource,
  paperPath,
  topicFilterHref,
  type LandingManifest,
} from "@/lib/search-landing";

const SITE_URL = "https://pastpaperprep.com";

export function QualificationHub({
  qualification,
  title,
  intro,
}: {
  qualification: Qualification;
  title: string;
  intro: string;
}) {
  const banks = getCatalogBanksForDisplay().filter((bank) => bank.qualification === qualification);
  const path = qualification === "IB Diploma" ? "/ib" : "/cambridge-igcse";

  return (
    <main className="search-hub shell">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        url: `${SITE_URL}${path}`,
        mainEntity: banks.map((bank) => ({
          "@type": "Course",
          name: bank.title,
          url: `${SITE_URL}/syllabus/${bank.slug}`,
        })),
      }} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
      <p className="eyebrow">Qualification hub</p>
      <h1>{title}</h1>
      <p className="lead">{intro}</p>
      <div className="search-bank-grid">
        {banks.map((bank) => <BankLandingCard key={bank.slug} bank={bank} />)}
      </div>
    </main>
  );
}

export function BankLandingCard({ bank }: { bank: CatalogBank }) {
  return (
    <article className="search-bank-card">
      <p className="eyebrow">{bank.subject}</p>
      <h2><Link href={`/banks/${bank.slug}`}>{bank.title}</Link></h2>
      <p>{bank.questionCount.toLocaleString()} archive questions across {bank.paperCount} indexed papers.</p>
      <Link className="text-button" href={`/syllabus/${bank.slug}`}>Syllabus and practice guide</Link>
    </article>
  );
}

export function SyllabusLanding({ bank, manifest }: { bank: CatalogBank; manifest: LandingManifest }) {
  const canonicalPath = `/syllabus/${bank.slug}`;

  return (
    <main className="search-landing shell">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${bank.title} syllabus and past-paper practice guide`,
        description: `A plain-English guide to ${bank.shortName}, its archive topic map, and focused past-paper practice.`,
        url: `${SITE_URL}${canonicalPath}`,
        isPartOf: { "@id": `${SITE_URL}/${bank.qualification === "IB Diploma" ? "ib" : "cambridge-igcse"}#page` },
      }} />
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        {
          label: bank.qualification,
          href: bank.qualification === "IB Diploma" ? "/ib" : "/cambridge-igcse",
        },
        { label: bank.shortName },
      ]} />
      <p className="eyebrow">Syllabus and practice guide</p>
      <h1>{bank.title} syllabus, topics, and past-paper practice</h1>
      <p className="lead">A plain-English map of the course, the archive, and the fastest route from a weak topic to real questions.</p>

      <section className="landing-copy">
        <h2>TLDR</h2>
        <p>{courseOverview(bank)}</p>
        <p>Use the official qualification page for the authoritative syllabus. Use this page to understand the shape of the course and move directly from a syllabus area into focused practice.</p>

        <h2>What the archive covers</h2>
        <p>
          {manifest.questionCount.toLocaleString()} question records are available across {manifest.paperCount} indexed paper records, covering {manifest.years}. Topic counts below are archive assignments and can overlap because one question may carry more than one topic label. They describe our archive, not the likelihood of a topic appearing in your exam.
        </p>

        <div className="topic-map">
          <h2>Plain-English topic map</h2>
          <p>These are the syllabus-aligned labels available in the current bank. Open any label to apply the exact topic filter without replacing the question interface.</p>
          <div className="topic-map-list">
            {manifest.syllabusTopics.map((topic) => (
              <Link key={topic.slug} href={topicFilterHref(bank.slug, topic.label)}>
                <strong>{topic.label}</strong>
                <span>{topic.count.toLocaleString()} archive assignments</span>
              </Link>
            ))}
          </div>
        </div>

        <h2>Patterns visible in this archive</h2>
        <p>
          The largest current topic-assignment groups are {manifest.topics.map((topic) => `${topic.label} (${topic.count.toLocaleString()})`).join(" and ")}. That is useful for understanding archive depth, but it is not an exam forecast: the archive spans multiple years, papers, syllabus versions, and questions with more than one label.
        </p>

        <div className="topic-map">
          <h2>Paper practice</h2>
          <p>Paper numbers are kept separate because the skills and conditions can differ. Check the official course document for the current assessment structure and use these links only to filter the archive.</p>
          <div className="topic-map-list">
            {manifest.papers.map((paper) => (
              <Link key={paper.slug} href={paperPath(bank.slug, paper)}>
                <strong>{paper.label}</strong>
                <span>{paper.count.toLocaleString()} archive questions</span>
              </Link>
            ))}
          </div>
        </div>

        <h2>How to use the map</h2>
        <p>Start with a narrow topic while repairing a gap. Remove the topic label for mixed practice once you can choose the method without a heading. Finish with the correct full paper under realistic conditions when pacing and switching are the main risks.</p>
        <p><a href={officialQualificationSource(bank)} target="_blank" rel="noreferrer">Read the official {bank.qualification} qualification page</a></p>
      </section>

      <div className="landing-actions">
        <Link className="button primary" href={`/banks/${bank.slug}`}>Practise all {bank.shortName} questions</Link>
        <Link className="button secondary" href={`/banks/${bank.slug}?free=1`}>Start the free preview</Link>
      </div>
    </main>
  );
}

export function SearchDetail({
  bank,
  title,
  kind,
  label,
  count,
  filterHref,
  canonicalPath,
}: {
  bank: CatalogBank;
  title: string;
  kind: "topic" | "paper";
  label: string;
  count: number;
  filterHref: string;
  canonicalPath: string;
}) {
  return (
    <main className="search-landing shell">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        url: `${SITE_URL}${canonicalPath}`,
        isPartOf: { "@id": `${SITE_URL}/banks/${bank.slug}#page` },
      }} />
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: bank.shortName, href: `/banks/${bank.slug}` },
        { label: title },
      ]} />
      <p className="eyebrow">Curated {kind} page</p>
      <h1>{title}</h1>
      <p className="lead">Practise {count.toLocaleString()} archive-assigned questions in this {kind} view. This is a useful entry point into the bank, not a prediction of future exams.</p>
      <section className="landing-copy">
        <h2>What this view is for</h2>
        <p>Use this focused set to diagnose mistakes, review the available mark scheme or solution, and then try a mixed set without the {kind} filter. The count is based on PastPaperPrep archive coverage and is not a guarantee of completeness or exam frequency.</p>
        <p><strong>{label}</strong> has an exact filter deep-link, so the question explorer remains the main practice experience.</p>
      </section>
      <div className="landing-actions">
        <Link className="button primary" href={filterHref}>Open the exact practice set</Link>
        <Link className="button secondary" href={`/syllabus/${bank.slug}`}>Read the syllabus guide</Link>
      </div>
    </main>
  );
}
