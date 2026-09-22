import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, Compass, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "About us",
  description: "How PastPaperPrep builds focused past-paper practice, classifies questions, and describes archive coverage honestly.",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
};

export default function AboutPage() {
  return (
    <main className="about-page shell public-editorial">
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "AboutPage", name: "About PastPaperPrep", url: "https://pastpaperprep.com/about", about: { "@id": "https://pastpaperprep.com/#organization" } },
        { "@context": "https://schema.org", "@type": "Organization", "@id": "https://pastpaperprep.com/#organization", name: "PastPaperPrep", url: "https://pastpaperprep.com/", description: "An independent practice platform for Cambridge IGCSE and IB Diploma past-paper questions.", email: "hello@pastpaperprep.com" },
      ]} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />
      <header className="landing-hero about-hero">
        <div><p className="eyebrow">About PastPaperPrep</p><h1>Focused practice, without the archive busywork.</h1></div>
        <div className="landing-hero-aside"><p>PastPaperPrep turns scattered papers into precise practice sets while keeping the original source, syllabus context, and limitations visible.</p></div>
      </header>

      <section className="about-principles" aria-label="PastPaperPrep principles">
        <article><Compass aria-hidden="true" /><strong>Specific</strong><span>Find the exact topic, paper, year, or session you need.</span></article>
        <article><ShieldCheck aria-hidden="true" /><strong>Source-aware</strong><span>Stay close to the original paper and official qualification guidance.</span></article>
        <article><CheckCircle aria-hidden="true" /><strong>Honest</strong><span>Archive patterns are labelled as patterns, never predictions.</span></article>
      </section>

      <div className="about-grid">
        <section><h2>Why it exists</h2><p>Past papers are valuable, but finding enough questions for one precise weakness usually means opening whole PDFs, checking variants, and rebuilding the same practice set by hand. PastPaperPrep removes that selection work without pretending software replaces a teacher or an official syllabus.</p><h2>What we do</h2><p>We organise question records by qualification, subject, topic, paper, year, and other archive fields so students can repair a narrow weakness, check their work, and return to mixed or timed practice.</p></section>
        <section><h2>How questions are handled</h2><p>Questions are classified using available source records, syllabus-oriented taxonomies, and review workflows. Corrections and worked solutions are kept separate from the original question record where possible. Coverage varies by bank, and classification is not a claim that an exam question is likely to recur.</p><h2>Editorial standards</h2><p>We prefer source-linked records, explicit archive counts, and plain descriptions of uncertainty. Topic totals can overlap because a question may carry more than one assignment. Official Cambridge and IB pages remain the authoritative source for qualification rules.</p></section>
        <section><h2>Rights and sources</h2><p>PastPaperPrep records the source and rights context available for each archive. A source link is not a claim that PastPaperPrep independently verifies every board or publisher right. Use official qualification sources and your school or coordinator for authoritative materials.</p></section>
        <section><h2>Updates and limitations</h2><p>The archive is curated and bounded. It may not include every session, paper, component, or syllabus version. Frequency counts describe archive coverage only; PastPaperPrep is not an exam board and does not predict exam content.</p><p>Found something wrong? Email <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a> with the bank and question details.</p></section>
      </div>
      <nav className="about-links" aria-label="PastPaperPrep resources"><Link href="/cambridge-igcse">Cambridge IGCSE <ArrowRight weight="bold" /></Link><Link href="/ib">IB Diploma <ArrowRight weight="bold" /></Link><Link href="/pricing">Pricing <ArrowRight weight="bold" /></Link><Link href="/articles">Revision guides <ArrowRight weight="bold" /></Link></nav>
    </main>
  );
}
