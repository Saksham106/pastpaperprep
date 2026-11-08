import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { getCatalogBanksForDisplay } from "@/lib/catalog";
import { freeTierScope } from "@/lib/free-tier-scope";
import { socialPreview } from "@/lib/seo";

export const metadata: Metadata = {
  title: "For teachers: free past papers and worked answers to share",
  description: "Free Cambridge IGCSE and IB past papers with mark schemes, worked answers, topic breakdowns and grade thresholds that students open without signing up.",
  alternates: { canonical: "/teachers" },
  openGraph: { url: "/teachers", ...socialPreview() },
};

/** What a teacher can hand to a class for free. Every item links to a live page; free-tier wording comes from the access policy. */
export default function TeachersPage() {
  const scope = freeTierScope(getCatalogBanksForDisplay());
  const items = [
    {
      title: "Whole past papers with mark schemes",
      body: "Every paper we hold opens free, with no account: the question paper, its mark scheme and an exam timer. Students can mark themselves question by question.",
      links: [{ href: "/past-papers/igcse", label: "Cambridge IGCSE papers" }, { href: "/past-papers/ib", label: "IB papers" }],
    },
    {
      title: "Worked answers you can link to",
      body: "On free-year papers, each question has a step-by-step solution showing the mark-scheme point every step earns. The link icon on each answer copies a link that opens straight at that question.",
      links: [{ href: "/past-papers/igcse-physics-0625/2021-may-june-42#worked-answers", label: "Example: 0625/42 May/June 2021" }],
    },
    {
      title: "What each paper tests",
      body: "Each paper-number page counts how often every topic appears across past sessions and, for IGCSE, shows Cambridge's grade thresholds for each variant. Useful for planning revision lessons.",
      links: [{ href: "/past-papers/igcse-chemistry-0620/paper-4", label: "Example: 0620 Paper 4" }],
    },
    {
      title: "Topic practice from older exam years",
      body: `Real past-paper questions sorted by syllabus topic. Free exam years are open in ${scope}; a free account unlocks the full free selection.`,
      links: [{ href: "/#question-banks", label: "All question banks" }],
    },
    {
      title: "Revision notes",
      body: "Free course notes that follow the syllabus, each lesson linked to past-paper questions on that topic.",
      links: [{ href: "/revision-notes", label: "Revision notes" }],
    },
  ];
  return (
    <div className="about-page shell public-editorial">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: "PastPaperPrep for teachers", url: "https://pastpaperprep.com/teachers", about: { "@id": "https://pastpaperprep.com/#organization" } }} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "For teachers" }]} />
      <header className="landing-hero about-hero">
        <div>
          <p className="eyebrow">For teachers</p>
          <h1>Free past papers and worked answers to share with your class</h1>
        </div>
        <div className="landing-hero-aside">
          <p>Everything on this page is free for students, with no sign-up. Link to any page from your school site, VLE or class chat; the addresses don&rsquo;t change.</p>
        </div>
      </header>

      <section className="about-section" aria-labelledby="teachers-free-title">
        <div className="about-section-heading">
          <p className="eyebrow">Free to use</p>
          <h2 id="teachers-free-title">What you can share</h2>
        </div>
        <div className="about-difference-list">
          {items.map(item => <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <p>{item.links.map((link, i) => <span key={link.href}>{i > 0 && " · "}<Link href={link.href}>{link.label}</Link></span>)}</p>
          </article>)}
        </div>
      </section>

      <section className="about-section" aria-labelledby="teachers-paid-title">
        <div className="about-section-heading">
          <p className="eyebrow">Paid access</p>
          <h2 id="teachers-paid-title">Printable topic worksheets</h2>
          <p>Newer exam years and PDF worksheet export need paid access. <Link href="/articles/pastpaperprep-for-tutors-printable-practice-sets">How to build a printable practice set</Link> · <Link href="/pricing">Plans</Link></p>
        </div>
      </section>

      <section className="about-section" aria-labelledby="teachers-contact-title">
        <div className="about-section-heading">
          <p className="eyebrow">Contact</p>
          <h2 id="teachers-contact-title">Found a mistake, or want a subject added?</h2>
          <p>Email <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a>. PastPaperPrep is independent and not affiliated with Cambridge International or the International Baccalaureate.</p>
        </div>
      </section>
    </div>
  );
}
