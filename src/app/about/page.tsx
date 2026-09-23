import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, Compass, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "About us",
  description: "What PastPaperPrep does, who it is for, how its question banks work, and how archive coverage is handled.",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
};

const faqs = [
  {
    question: "What is PastPaperPrep?",
    answer: "PastPaperPrep is an independent online practice platform for Cambridge IGCSE and IB Diploma students. It organises authentic past-paper questions into focused banks that can be filtered by topic, paper, year, session, and other useful exam fields.",
  },
  {
    question: "Is PastPaperPrep an exam board?",
    answer: "No. PastPaperPrep is not affiliated with or endorsed by Cambridge International Education or the International Baccalaureate Organization. Official qualification websites remain the authoritative source for syllabus rules and examination requirements.",
  },
  {
    question: "How are questions organised?",
    answer: "Question records are mapped to syllabus-oriented topics and archive metadata using source records, classification workflows, and review checks. Some questions can carry more than one topic assignment, so topic totals may overlap.",
  },
  {
    question: "Can I try PastPaperPrep before subscribing?",
    answer: "Yes. You can browse the banks without subscribing, and supported banks include complete older exam years that can be practised for free. Paid access unlocks the wider archive and eligible PDF export features according to the selected plan.",
  },
];

export default function AboutPage() {
  return (
    <main className="about-page shell public-editorial">
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
            description: "An independent practice platform for Cambridge IGCSE and IB Diploma past-paper questions.",
            email: "hello@pastpaperprep.com",
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          },
        ]}
      />

      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About" }]} />

      <header className="landing-hero about-hero">
        <div>
          <p className="eyebrow">About PastPaperPrep</p>
          <h1>Focused practice, without the archive busywork.</h1>
        </div>
        <div className="landing-hero-aside">
          <p>
            PastPaperPrep is an independent practice platform that turns scattered Cambridge IGCSE and IB Diploma papers into precise, filterable question sets.
          </p>
        </div>
      </header>

      <section className="about-principles" aria-label="PastPaperPrep principles">
        <article><Compass aria-hidden="true" /><strong>Specific</strong><span>Find the exact topic, paper, year, or session you need.</span></article>
        <article><ShieldCheck aria-hidden="true" /><strong>Source-aware</strong><span>Stay close to the original paper and official qualification guidance.</span></article>
        <article><CheckCircle aria-hidden="true" /><strong>Honest</strong><span>Archive patterns are labelled as patterns, never predictions.</span></article>
      </section>

      <section className="about-section about-what" aria-labelledby="about-what-title">
        <div className="about-section-heading">
          <p className="eyebrow">The product</p>
          <h2 id="about-what-title">What PastPaperPrep does</h2>
          <p>It removes the selection work between finding a weakness and practising it properly.</p>
        </div>
        <div className="about-feature-grid">
          <article><span>01</span><h3>Find precise practice</h3><p>Choose a qualification and bank, then narrow the archive by topic, subtopic, paper, year, session, or other available exam fields.</p></article>
          <article><span>02</span><h3>Check the source answer</h3><p>Use the linked answer or mark-scheme material available for a question, while keeping the original paper context visible.</p></article>
          <article><span>03</span><h3>Build a useful set</h3><p>Move from one weak area into mixed or timed work, and create printable practice sets where the selected plan supports export.</p></article>
        </div>
      </section>

      <section className="about-section about-difference" aria-labelledby="about-difference-title">
        <div className="about-section-heading">
          <p className="eyebrow">Why it is different</p>
          <h2 id="about-difference-title">What makes PastPaperPrep different</h2>
        </div>
        <div className="about-difference-list">
          <article><h3>Authentic archive questions</h3><p>The core practice material comes from real past papers rather than newly written questions made to resemble an exam.</p></article>
          <article><h3>Granular filtering</h3><p>Students can isolate a narrow weakness without repeatedly opening full PDFs and hunting through unrelated questions.</p></article>
          <article><h3>Source and syllabus context</h3><p>Paper metadata, qualification context, and limitations stay visible instead of being flattened into an anonymous question feed.</p></article>
          <article><h3>No fake certainty</h3><p>Historical topic frequency describes this archive. It is not presented as official weighting or a guaranteed forecast of the next exam.</p></article>
        </div>
      </section>

      <section className="about-audience-workflow">
        <div className="about-audience" aria-labelledby="about-audience-title">
          <p className="eyebrow">Built for</p>
          <h2 id="about-audience-title">Who uses PastPaperPrep</h2>
          <ul>
            <li>Cambridge IGCSE students repairing a specific topic weakness.</li>
            <li>IB Diploma students practising by course, level, topic, or paper.</li>
            <li>Tutors assembling focused homework and printable practice sets.</li>
            <li>Teachers looking for source-aware questions across past sessions.</li>
          </ul>
        </div>
        <div className="about-workflow" aria-labelledby="about-workflow-title">
          <p className="eyebrow">The workflow</p>
          <h2 id="about-workflow-title">How PastPaperPrep works</h2>
          <ol>
            <li><strong>Choose a bank.</strong><span>Select the exact subject, syllabus code, course, and level.</span></li>
            <li><strong>Narrow the archive.</strong><span>Filter to the topic, paper, or session that matches the current goal.</span></li>
            <li><strong>Practise and mark.</strong><span>Work through the questions and check the available source answers.</span></li>
            <li><strong>Repeat with intent.</strong><span>Stay focused until the weakness improves, then return to mixed or timed work.</span></li>
          </ol>
        </div>
      </section>

      <section className="about-section about-facts-section" aria-labelledby="about-facts-title">
        <div className="about-section-heading">
          <p className="eyebrow">At a glance</p>
          <h2 id="about-facts-title">Key facts</h2>
        </div>
        <dl className="about-facts" data-testid="about-key-facts">
          <div><dt>Company name</dt><dd>PastPaperPrep</dd></div>
          <div><dt>Type</dt><dd>Independent online education and exam-practice platform</dd></div>
          <div><dt>Qualifications</dt><dd>Cambridge IGCSE and IB Diploma</dd></div>
          <div><dt>Core offering</dt><dd>Filterable past-paper question banks with source answers and printable practice tools where available</dd></div>
          <div><dt>Audience</dt><dd>Students, tutors, and teachers</dd></div>
          <div><dt>Pricing</dt><dd>Monthly and annual subscriptions. <Link href="/pricing">View current plans</Link>.</dd></div>
          <div><dt>Website</dt><dd><a href="https://pastpaperprep.com">pastpaperprep.com</a></dd></div>
          <div><dt>Support</dt><dd><a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a></dd></div>
        </dl>
      </section>

      <section className="about-section about-standards" aria-labelledby="about-standards-title">
        <div className="about-section-heading">
          <p className="eyebrow">Trust and limitations</p>
          <h2 id="about-standards-title">How the archive is handled</h2>
        </div>
        <div className="about-grid">
          <section><h3>Classification and review</h3><p>Questions are classified using available source records, syllabus-oriented taxonomies, and review workflows. Corrections and worked solutions are kept separate from the original question record where possible.</p></section>
          <section><h3>Editorial standards</h3><p>We prefer source-linked records, explicit archive counts, and plain descriptions of uncertainty. Topic totals can overlap because a question may carry more than one assignment.</p></section>
          <section><h3>Rights and sources</h3><p>PastPaperPrep records the source and rights context available for each archive. Official Cambridge and IB pages remain the authoritative source for qualification rules.</p></section>
          <section><h3>Coverage and corrections</h3><p>The archive is curated and bounded, so coverage can vary by bank. Found something wrong? Email <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a> with the bank and question details.</p></section>
        </div>
      </section>

      <section className="about-section about-faq" aria-labelledby="about-faq-title">
        <div className="about-section-heading">
          <p className="eyebrow">Common questions</p>
          <h2 id="about-faq-title">Frequently asked questions</h2>
        </div>
        <div className="about-faq-list">
          {faqs.map((faq) => <article key={faq.question}><h3>{faq.question}</h3><p>{faq.answer}</p></article>)}
        </div>
      </section>

      <nav className="about-links" aria-label="PastPaperPrep resources">
        <Link href="/cambridge-igcse">Cambridge IGCSE <ArrowRight weight="bold" /></Link>
        <Link href="/ib">IB Diploma <ArrowRight weight="bold" /></Link>
        <Link href="/pricing">Pricing <ArrowRight weight="bold" /></Link>
        <Link href="/articles">Revision guides <ArrowRight weight="bold" /></Link>
      </nav>
    </main>
  );
}
