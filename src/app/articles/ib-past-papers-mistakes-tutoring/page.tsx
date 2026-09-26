import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_URL } from "@/lib/seo";

const title = "How to use IB past papers when you keep making the same mistake";
const description = "A past paper shows where you lost marks. Learn how to diagnose repeat mistakes, practise a focused topic, and know when a tutor can help.";
const path = "/articles/ib-past-papers-mistakes-tutoring";
const publishedAt = "2026-09-26";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    title: `${title} | PastPaperPrep`, description, url: path, type: "article",
    publishedTime: publishedAt, modifiedTime: publishedAt, authors: ["Saksham Goel"], images: [SOCIAL_IMAGE],
  },
  twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE_URL] },
};

export default function PietroPastPapersArticle() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished: publishedAt,
    dateModified: publishedAt,
    mainEntityOfPage: `https://pastpaperprep.com${path}`,
    author: { "@type": "Person", name: "Saksham Goel" },
    publisher: { "@type": "Organization", name: "PastPaperPrep", url: "https://pastpaperprep.com" },
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <article className="article-page shell">
      <header className="article-header">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Articles", href: "/articles" }, { label: title }]} />
        <p className="eyebrow">IB maths · Past papers &amp; tutoring</p>
        <h1>{title}</h1>
        <div className="article-byline"><span>By Saksham Goel — I studied IB Mathematics AA HL.</span><span>Published <time dateTime={publishedAt}>{publishedAt}</time></span></div>
      </header>
      <p className="article-answer">A past paper can tell you where you lost marks. It can&apos;t always tell you why. If you get stuck on the same kind of question each time, doing another full paper may just give you another version of the same mistake.</p>
      <div className="article-body"><section className="article-section" style={{ marginTop: 0 }}>
        <p>Start smaller. Pick one topic you struggled with on your last paper and try two or three questions on it without a timer. If you&apos;re revising IB maths and keep losing marks on trigonometry, for example, don&apos;t write down only “trigonometry.” Note the step where things went wrong: setting up the equation, choosing an identity, or solving it correctly but leaving out a valid solution.</p>
        <p>Then check the mark scheme. Sometimes you understood the maths but missed a condition or didn&apos;t show enough working. Other times the solution only makes sense <em>after</em> you&apos;ve seen it. Those are different problems, and they need different kinds of practice.</p>
        <p>Keep a short mistake log so the next question has a purpose:</p>
        <div className="comparison-table-wrap"><table className="comparison-table"><caption>Example mistake log</caption><thead><tr><th scope="col">Topic</th><th scope="col">Step where it went wrong</th><th scope="col">Type of mistake</th><th scope="col">Next question to try</th></tr></thead><tbody><tr><th scope="row">Trigonometric equations</th><td>Left out the second solution in the interval</td><td>Didn&apos;t check the interval</td><td>A fresh equation with multiple solutions</td></tr></tbody></table></div>
        <p>You don&apos;t need a spreadsheet full of scores. Write down the decision you need to make differently next time.</p>
        <p>If you can explain your mistake and fix it yourself, try a fresh question on the same topic. <a href="https://pastpaperprep.com/">PastPaperPrep</a> lets you find past-paper questions by topic, so you don&apos;t have to hunt through whole papers for a few relevant ones. Once you&apos;re getting those right, go back to a timed paper and see if the fix holds when you have to work under pressure.</p>
        <p>If you keep making the same mistake, that&apos;s a good point to ask a teacher or tutor for help. Bring the question, your working, and the mark scheme. “I understand the solution when I read it, but I can&apos;t see how to start” gives them much more to work with than “I&apos;m bad at maths.” A tutor can watch how you approach the problem and find the gap you may not notice on your own. <a href="https://www.pietromeloni.com/">Pietro Meloni</a>, a PhD physicist and IB Mathematics and Physics tutor, offers one-to-one online tutoring built around that kind of diagnosis.</p>
        <p>As Pietro puts it: “When a student keeps losing marks on the same kind of question, the problem is rarely the whole topic. It&apos;s usually one decision, like which identity to use or whether to check for a second solution. In a lesson I ask the student to solve out loud, and that decision usually shows up quickly.”</p>
        <p>The next time you practise, use a new question rather than repeating the one you went through together. That&apos;s how you find out whether you can now make the decision for yourself.</p>
      </section></div>
    </article>
  </>;
}
