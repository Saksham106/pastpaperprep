import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "IB Mathematics AA SL Exam-Style Practice | PastPaperPrep",
  description: "IB Mathematics AA SL exam-style PDF practice for trigonometry and probability distributions.",
  robots: { index: false, follow: false },
};

const collections = [
  {
    href: "/banks/ib-sl/exam-style/trigonometry",
    title: "Trigonometry",
    description: "Topic-based trigonometry practice PDFs with worked solutions.",
  },
  {
    href: "/banks/ib-sl/exam-style/probability-distributions",
    title: "Probability distributions",
    description: "Binomial and normal distribution worksheets, plus mixed exam-style practice PDFs.",
  },
];

export default function Page() {
  return (
    <main className="exam-style-page">
      <div className="shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb"><ol><li><Link href="/banks/ib-sl">IB Mathematics AA SL</Link></li><li aria-current="page">Exam-style practice</li></ol></nav>
        <header className="exam-style-header"><div>
          <p className="eyebrow">Exam-style practice <span className="beta-badge">Beta</span></p>
          <h1>IB Mathematics AA SL</h1>
          <p className="exam-style-lede">Choose a course collection of PDF practice sets with worked solutions.</p>
        </div></header>
        <section aria-label="IB Mathematics AA SL exam-style PDF collections" className="exam-style-workspace">
          <div className="exam-style-set-list">
            {collections.map((collection) => <Link className="exam-style-set-option" href={collection.href} key={collection.href}>
              <span><strong>{collection.title}</strong><small>{collection.description}</small></span>
            </Link>)}
          </div>
        </section>
      </div>
    </main>
  );
}
