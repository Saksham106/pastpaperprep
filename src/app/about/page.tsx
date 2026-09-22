import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
export const metadata: Metadata = {
  title: "About us",
  description:
    "How PastPaperPrep builds focused past-paper practice, classifies questions, and describes archive coverage honestly.",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
};
export default function AboutPage() {
  return (
    <main className="about-page shell">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: "About PastPaperPrep",
            url: "https://pastpaperprep.com/about",
            about: { "@id": "https://pastpaperprep.com/#organization" },
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": "https://pastpaperprep.com/#organization",
            name: "PastPaperPrep",
            url: "https://pastpaperprep.com/",
            founder: { "@type": "Person", name: "Saksham Goel" },
            description:
              "An independent practice platform for Cambridge IGCSE and IB Diploma past-paper questions.",
            email: "hello@pastpaperprep.com",
          },
        ]}
      />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />
      <p className="eyebrow">About PastPaperPrep</p>
      <h1>Focused practice from real past-paper questions</h1>
      <p className="lead">
        PastPaperPrep is an independent practice platform for students who want
        to move from a broad question bank to a useful, focused set.
      </p>
      <div className="about-grid">
        <section>
          <h2>Why it exists</h2>
          <p>
            Saksham Goel founded PastPaperPrep after his own experience with IGCSE and IB revision. Past papers were valuable, but finding enough questions for one precise weakness meant opening whole PDFs, checking paper variants, and rebuilding the same practice set by hand. PastPaperPrep exists to remove that selection work without pretending that software replaces a teacher or an official syllabus.
          </p>
          <h2>What we do</h2>
          <p>
            We organise question records by qualification, subject, topic,
            paper, year, and other archive fields so students can practise a
            narrow weakness, check their work, and return to mixed or timed
            practice.
          </p>
          <h2>How questions are handled</h2>
          <p>
            Questions are classified using the available source record,
            syllabus-oriented taxonomies, and review workflows. Corrections and
            worked solutions are kept separate from the original question record
            where possible. Coverage varies by bank, and classification is not a
            claim that an exam question is likely to recur.
          </p>
          <h2>Editorial and research standards</h2>
          <p>
            We prefer source-linked records, explicit archive counts, and plain
            descriptions of uncertainty. Topic totals can overlap because a
            question may have more than one assignment. We do not copy official
            syllabus text onto this site, and we link to official Cambridge or
            IB pages for authoritative qualification information.
          </p>
        </section>
        <section>
          <h2>Rights and sources</h2>
          <p>
            PastPaperPrep identifies the source and rights context available for
            each archive record. A source link or archive record is not a claim
            that PastPaperPrep independently verifies every board or publisher
            right. Use official qualification sources and your school or
            coordinator for authoritative materials.
          </p>
          <h2>Updates and corrections</h2>
          <p>
            If a classification, source link, solution, or coverage description
            is wrong, contact{" "}
            <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a>{" "}
            with the bank and question details. We review correction reports and
            update the affected record when the evidence supports a change.
          </p>
          <h2>Limitations</h2>
          <p>
            The archive is curated and bounded. It may not include every
            session, paper, component, or syllabus version, and its frequency
            counts are descriptive archive coverage only. PastPaperPrep is not
            an exam board and does not predict exam content.
          </p>
        </section>
      </div>
      <nav className="about-links" aria-label="PastPaperPrep resources">
        <Link href="/cambridge-igcse">Cambridge IGCSE banks</Link>
        <Link href="/ib">IB Diploma banks</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/articles">Revision guides</Link>
      </nav>
    </main>
  );
}
