import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKey } from "@phosphor-icons/react/dist/ssr";
import { ExamStyleInductionSets } from "@/components/ExamStyleInductionSets";
import { createClient } from "@/lib/supabase/server";

const RETURN_PATH = "/banks/ib-hl/exam-style/proof-by-induction";

export const metadata: Metadata = {
  title: "Proof by Induction Exam-Style Practice | IB Mathematics AA HL",
  description: "Three original exam-style practice sets on divisibility, sequences, and inequalities, with worked solutions. Not official IB past papers.",
  robots: { index: false, follow: false },
};

export default async function InductionExamStylePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authenticated = Boolean(claimsData?.claims?.sub);
  return (
    <main className="exam-style-page"><div className="shell">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><ol><li><Link href="/banks/ib-hl">IB Mathematics AA HL</Link></li><li aria-current="page">Exam-style practice</li></ol></nav>
      <header className="exam-style-header"><div>
        <p className="eyebrow">Exam-style practice <span className="beta-badge">Beta</span></p>
        <h1>Proof by induction</h1>
        <p className="exam-style-lede">Original practice sets for divisibility, sequences, and inequalities, with worked solutions. These are not official IB past-paper questions.</p>
      </div><Link className="text-link" href="/banks/ib-hl"><ArrowLeft aria-hidden="true" /> Back to the question bank</Link></header>
      {authenticated ? <ExamStyleInductionSets /> : <section className="exam-style-auth-gate" aria-labelledby="exam-style-auth-heading">
        <span className="exam-style-auth-icon" aria-hidden="true"><LockKey weight="bold" /></span>
        <p className="eyebrow">Free account required</p><h2 id="exam-style-auth-heading">Sign in to view this practice</h2>
        <p>Create a free account or sign in to open the practice sets and worked solutions.</p>
        <Link className="button primary" href={`/login?next=${encodeURIComponent(RETURN_PATH)}`}>Sign in or create an account</Link>
      </section>}
    </div></main>
  );
}
