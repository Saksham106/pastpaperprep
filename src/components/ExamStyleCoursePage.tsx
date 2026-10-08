import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKey } from "@phosphor-icons/react/dist/ssr";
import { ExamStyleWorksheetLibrary } from "@/components/ExamStyleWorksheetLibrary";
import { createClient } from "@/lib/supabase/server";
import { EXAM_STYLE_COURSES, type ExamStyleCourse } from "@/lib/exam-style-worksheets";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export async function ExamStyleCoursePage({ course, title, description }: { course: ExamStyleCourse; title: string; description: string }) {
  const courseInfo = EXAM_STYLE_COURSES[course];
  const returnPath = `/banks/${course === "ib-math-aa-sl" ? "ib-sl" : course === "igcse-0580" ? "igcse" : "igcse-additional"}/exam-style`;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const authenticated = Boolean(claimsData?.claims?.sub);
  return (
    <main className="exam-style-page">
      <div className="shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb"><ol><li><Link href={courseInfo.route}>{courseInfo.label}</Link></li><li aria-current="page">Exam-style practice</li></ol></nav>
        <header className="exam-style-header">
          <div><p className="eyebrow">Exam-style practice <span className="beta-badge">Beta</span></p><h1>{title}</h1><p className="exam-style-lede">{description}</p></div>
          <Link className="text-link" href={courseInfo.route}><ArrowLeft aria-hidden="true" /> Back to the question bank</Link>
        </header>
        {authenticated ? <ExamStyleWorksheetLibrary worksheets={courseInfo.worksheets} /> : (
          <section className="exam-style-auth-gate" aria-labelledby="exam-style-auth-heading">
            <span className="exam-style-auth-icon" aria-hidden="true"><LockKey weight="bold" /></span><p className="eyebrow">Free account required</p><h2 id="exam-style-auth-heading">Sign in to view this practice</h2>
            <p>Create a free account or sign in to open the practice sets and worked solutions.</p><Link className="button primary" href={`/login?next=${encodeURIComponent(returnPath)}`}>Sign in or create an account</Link>
          </section>
        )}
      </div>
    </main>
  );
}
