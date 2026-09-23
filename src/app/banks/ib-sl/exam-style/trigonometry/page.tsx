import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ExamStylePracticeSets } from "@/components/ExamStylePracticeSets";

export const metadata: Metadata = {
  title: "Trigonometry Exam-Style Practice | IB Mathematics AA SL",
  description: "Topic-based practice sets with worked solutions. This beta currently covers Trigonometry for IB Mathematics AA SL.",
  robots: { index: false, follow: false },
};

export default function TrigonometryExamStylePage() {
  return (
    <main className="exam-style-page">
      <div className="shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <ol><li><Link href="/banks/ib-sl">IB Mathematics AA SL</Link></li><li aria-current="page">Exam-style practice</li></ol>
        </nav>
        <header className="exam-style-header">
          <div>
            <p className="eyebrow">Exam-style practice <span className="beta-badge">Beta</span></p>
            <h1>Trigonometry</h1>
            <p className="exam-style-lede">Topic-based practice sets with worked solutions. This beta currently covers Trigonometry for IB Mathematics AA SL.</p>
          </div>
          <Link className="text-link" href="/banks/ib-sl"><ArrowLeft aria-hidden="true" /> Back to the question bank</Link>
        </header>
        <ExamStylePracticeSets />
      </div>
    </main>
  );
}
