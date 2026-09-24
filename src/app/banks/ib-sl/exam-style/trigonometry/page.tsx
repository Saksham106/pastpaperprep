import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKey } from "@phosphor-icons/react/dist/ssr";
import { ExamStylePracticeSets } from "@/components/ExamStylePracticeSets";
import { createClient } from "@/lib/supabase/server";

const RETURN_PATH = "/banks/ib-sl/exam-style/trigonometry";

export const metadata: Metadata = {
  title: "Trigonometry Exam-Style Practice | IB Mathematics AA SL",
  description: "Topic-based practice sets with worked solutions. This beta currently covers Trigonometry for IB Mathematics AA SL.",
  robots: { index: false, follow: false },
};

export default async function TrigonometryExamStylePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authenticated = Boolean(claimsData?.claims?.sub);
  const loginHref = `/login?next=${encodeURIComponent(RETURN_PATH)}`;

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
        {authenticated ? (
          <ExamStylePracticeSets />
        ) : (
          <section className="exam-style-auth-gate" aria-labelledby="exam-style-auth-heading">
            <span className="exam-style-auth-icon" aria-hidden="true"><LockKey weight="bold" /></span>
            <p className="eyebrow">Free account required</p>
            <h2 id="exam-style-auth-heading">Sign in to view this practice</h2>
            <p>Create a free account or sign in to open the practice sets and worked solutions.</p>
            <Link className="button primary" href={loginHref}>Sign in or create an account</Link>
          </section>
        )}
      </div>
    </main>
  );
}
