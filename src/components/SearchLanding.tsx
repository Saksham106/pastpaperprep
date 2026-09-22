import Link from "next/link";
import { ArrowRight, ChartBar, Clock, FileText, LockKey, Target } from "@phosphor-icons/react/dist/ssr";
import type { CatalogBank, Qualification } from "@/lib/catalog";
import { getCatalogBanksForDisplay } from "@/lib/catalog";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CourseIcon, courseToneForBank } from "@/components/CourseIcon";
import { JsonLd } from "@/components/JsonLd";
import { assessmentGuideFor } from "@/lib/assessment-guides";
import type { AssessmentPaper } from "@/lib/assessment-guides";
import {
  courseOverview,
  officialQualificationSource,
  paperPath,
  topicFilterHref,
  type LandingManifest,
} from "@/lib/search-landing";

const SITE_URL = "https://pastpaperprep.com";

function assessmentGroups(papers: AssessmentPaper[]) {
  const routes = new Map<string, AssessmentPaper[]>();
  for (const paper of papers) {
    const key = paper.route ?? "All candidates";
    routes.set(key, [...(routes.get(key) ?? []), paper]);
  }

  const order = ["Core", "Extended", "Both routes", "All candidates"];
  return [...routes.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([route, routePapers]) => ({
      route,
      title: route === "Core" ? "Core route" : route === "Extended" ? "Extended route" : route === "Both routes" ? "Practical option · choose one" : "All candidates",
      note: route === "Core"
        ? "Core students take these two papers, then choose one practical-skills paper below."
        : route === "Extended"
          ? "Extended students take these two papers, then choose one practical-skills paper below."
          : route === "Both routes"
            ? "Core and Extended students take either Paper 5 or Paper 6, not both."
            : undefined,
      papers: routePapers,
    }));
}

export function QualificationHub({ qualification, title, intro }: { qualification: Qualification; title: string; intro: string }) {
  const banks = getCatalogBanksForDisplay().filter((bank) => bank.qualification === qualification);
  const path = qualification === "IB Diploma" ? "/ib" : "/cambridge-igcse";
  return (
    <main className="search-hub shell public-editorial">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: `${SITE_URL}${path}`, mainEntity: banks.map((bank) => ({ "@type": "Course", name: bank.title, url: `${SITE_URL}/syllabus/${bank.slug}` })) }} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
      <header className="landing-hero landing-hero-hub">
        <div><p className="eyebrow">Qualification hub</p><h1>{title}</h1></div>
        <div className="landing-hero-aside"><p>{intro}</p><strong>{banks.length}</strong><span>question banks</span></div>
      </header>
      <div className="search-bank-grid">
        {banks.map((bank) => <BankLandingCard key={bank.slug} bank={bank} />)}
      </div>
    </main>
  );
}

export function BankLandingCard({ bank }: { bank: CatalogBank }) {
  const tone = courseToneForBank(bank);
  return (
    <article className={`search-bank-card course-tone-${tone}`} data-subject-tone={tone}>
      <span className="search-bank-watermark" aria-hidden="true"><CourseIcon tone={tone} marker={false} /></span>
      <div className="search-bank-card-head"><CourseIcon tone={tone} /><p className="eyebrow">{bank.subject}</p></div>
      <h2><Link href={`/syllabus/${bank.slug}`}>{bank.title}</Link></h2>
      <p>{bank.questionCount.toLocaleString()} archive questions · {bank.paperCount} indexed papers</p>
      <Link className="text-button" href={`/syllabus/${bank.slug}`}>Open the course guide <ArrowRight weight="bold" /></Link>
    </article>
  );
}

function ArchiveStats({ bank, manifest }: { bank: CatalogBank; manifest: LandingManifest }) {
  return <aside className="landing-hero-aside archive-stats" aria-label="Archive coverage">
    <div><strong>{manifest.questionCount.toLocaleString()}</strong><span>questions</span></div>
    <div><strong>{manifest.paperCount.toLocaleString()}</strong><span>archive papers</span></div>
    <div><strong>{manifest.years}</strong><span>coverage</span></div>
    <Link className="button primary" href={`/banks/${bank.slug}?free=0`}>Open the question bank <ArrowRight weight="bold" /></Link>
    <small><LockKey weight="bold" /> Public metadata; paid questions stay locked.</small>
  </aside>;
}

export function SyllabusLanding({ bank, manifest }: { bank: CatalogBank; manifest: LandingManifest }) {
  const canonicalPath = `/syllabus/${bank.slug}`;
  const guide = assessmentGuideFor(bank);
  const groupedPapers = assessmentGroups(guide.papers);
  const maxTopicCount = Math.max(1, ...manifest.syllabusTopics.map((topic) => topic.count));
  const tone = courseToneForBank(bank);
  return (
    <main className={`search-landing shell public-editorial course-tone-${tone}`} data-subject-tone={tone}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: `${bank.title} syllabus and past-paper practice guide`, description: `A plain-English guide to ${bank.shortName}, its assessment structure, archive topic map, and focused past-paper practice.`, url: `${SITE_URL}${canonicalPath}`, isPartOf: { "@id": `${SITE_URL}/${bank.qualification === "IB Diploma" ? "ib" : "cambridge-igcse"}#page` } }} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: bank.qualification, href: bank.qualification === "IB Diploma" ? "/ib" : "/cambridge-igcse" }, { label: bank.shortName }]} />
      <header className="landing-hero">
        <div className="landing-hero-copy"><p className="eyebrow">Syllabus and practice guide</p><h1>{bank.title} syllabus, topics, and past-paper practice</h1><p className="lead">A clear map of what the course covers, how it is assessed, and where real archive practice fits.</p></div>
        <ArchiveStats bank={bank} manifest={manifest} />
      </header>

      <section className="landing-copy">
        <div className="landing-summary"><div><p className="eyebrow">The short version</p><h2>What this course is really asking you to do.</h2></div><p>{courseOverview(bank)}</p></div>

        <section className="assessment-section" aria-labelledby="assessment-heading">
          <header><div><p className="eyebrow">Assessment at a glance</p><h2 id="assessment-heading">Papers, timing, and what they test</h2></div><span>{guide.version}</span></header>
          <p className="assessment-summary">{guide.summary}</p>
          <div className="assessment-groups">
            {groupedPapers.map((group, groupIndex) => {
              const headingId = `assessment-group-${groupIndex}`;
              return <section className="assessment-group" aria-labelledby={headingId} key={group.route}>
                <header><div><h3 id={headingId}>{group.title}</h3>{group.note && <p>{group.note}</p>}</div><span>{group.papers.length} {group.papers.length === 1 ? "component" : "components"}</span></header>
                <div className="assessment-grid">
                  {group.papers.map((paper) => <article className="assessment-card" key={`${paper.name}-${paper.route ?? "all"}`}>
                    <div className="assessment-card-title"><FileText aria-hidden="true" /><div><strong>{paper.name}</strong></div></div>
                    <p>{paper.format}</p>
                    <dl>
                      {paper.duration && <div><dt><Clock aria-hidden="true" /> Time</dt><dd>{paper.duration}</dd></div>}
                      {paper.marks && <div><dt>Marks</dt><dd>{paper.marks}</dd></div>}
                      {paper.weighting && <div><dt>Weight</dt><dd>{paper.weighting}</dd></div>}
                    </dl>
                  </article>)}
                </div>
              </section>;
            })}
          </div>
          {guide.caveat && <p className="landing-caveat">{guide.caveat}</p>}
        </section>

        <section className="topic-visual" aria-labelledby="topic-map-heading">
          <header><div><p className="eyebrow">Historical topic frequency</p><h2 id="topic-map-heading">How often topics appear in the archive</h2></div><p>Bar length compares topic-tag counts across the covered years. The longest bar is the most frequently tagged topic in this archive.</p></header>
          <div className="topic-bars">
            {manifest.syllabusTopics.map((topic) => <Link key={topic.slug} href={topicFilterHref(bank.slug, topic.label)} className="topic-bar-row">
              <span className="topic-bar-label">{topic.label}</span>
              <span className="topic-bar-track" aria-hidden="true"><i style={{ width: `${Math.max(3, (topic.count / maxTopicCount) * 100)}%` }} /></span>
              <strong>{topic.count.toLocaleString()}</strong>
            </Link>)}
          </div>
          <p className="landing-caveat">This is observed historical frequency: the strongest archive-backed estimate of relative topic prevalence, not an official syllabus weighting or a guarantee of what appears next. A question can carry more than one topic label, so counts can overlap.</p>
        </section>

        <section className="paper-practice" aria-labelledby="paper-practice-heading">
          <header><div><p className="eyebrow">Paper practice</p><h2 id="paper-practice-heading">Move from a topic to exam conditions</h2></div><p>Each page explains the archive slice, then opens the same bank explorer with the exact paper filter applied.</p></header>
          <div className="paper-link-grid">{manifest.papers.map((paper) => <Link key={paper.slug} href={paperPath(bank.slug, paper)}><FileText aria-hidden="true" /><span><strong>{paper.label}</strong><small>{paper.count.toLocaleString()} archived questions</small></span><ArrowRight weight="bold" /></Link>)}</div>
        </section>

        <section className="landing-method"><div><Target aria-hidden="true" /><h2>Use the map without overthinking it</h2></div><ol><li>Repair one narrow topic.</li><li>Remove the label and mix methods.</li><li>Finish with the correct paper under timed conditions.</li></ol></section>
        <p className="official-source"><a href={officialQualificationSource(bank)} target="_blank" rel="noreferrer">Read the official {bank.qualification} course source <ArrowRight weight="bold" /></a></p>
      </section>
    </main>
  );
}

export function SearchDetail({ bank, title, kind, label, count, filterHref, canonicalPath }: { bank: CatalogBank; title: string; kind: "topic" | "paper"; label: string; count: number; filterHref: string; canonicalPath: string }) {
  const tone = courseToneForBank(bank);
  return (
    <main className={`search-landing search-detail shell public-editorial course-tone-${tone}`} data-subject-tone={tone}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: `${SITE_URL}${canonicalPath}`, isPartOf: { "@id": `${SITE_URL}/banks/${bank.slug}#page` } }} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: bank.shortName, href: `/banks/${bank.slug}` }, { label: title }]} />
      <header className="search-detail-header">
        <div><p className="eyebrow">{kind === "topic" ? "Topic practice" : "Paper practice"}</p><h1>{title}</h1><p className="lead">A clean entry point into the existing question bank, with the exact {kind} filter already applied.</p></div>
        <aside className="detail-signal"><ChartBar aria-hidden="true" /><strong>{count.toLocaleString()}</strong><span>archived questions {kind === "topic" ? "tagged to" : "matching"} {label}</span><small>{kind === "topic" ? "An observed historical topic count, not a guarantee of what appears next." : "Archive coverage for this paper filter; access rules still apply in the question bank."}</small></aside>
      </header>
      <section className="detail-workflow">
        <div><span>01</span><strong>Open the set</strong><p>The link carries the exact filter into the regular bank explorer.</p></div>
        <div><span>02</span><strong>Check access</strong><p>Free questions open normally. Paid questions remain visible but locked until the bank is included in your plan.</p></div>
        <div><span>03</span><strong>Mix it up</strong><p>Remove the filter after focused practice to test whether you can recognise the method unaided.</p></div>
      </section>
      <div className="landing-actions">
        <Link className="button primary" href={`${filterHref}${filterHref.includes("?") ? "&" : "?"}free=0`}>Open this practice set <ArrowRight weight="bold" /></Link>
        <Link className="button secondary" href={`/syllabus/${bank.slug}`}>Read the syllabus guide</Link>
      </div>
      <p className="access-footnote"><LockKey weight="bold" /> These public pages expose labels and counts only. They do not unlock paid questions, answers, or PDF exports.</p>
    </main>
  );
}
