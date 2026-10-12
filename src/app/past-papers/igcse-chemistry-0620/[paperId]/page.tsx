import type { Metadata } from 'next';
import { Young_Serif } from 'next/font/google';
import { notFound } from 'next/navigation';
import { PastPaperReader } from '@/components/PastPaperReader';
import { PaperMarkingWorkspace } from '@/components/PaperMarkingWorkspace';
import { getChemistryPaper, localChemistryPaperPreviewEnabled } from '@/lib/chemistry-paper-archive';
import styles from '../../preview/page.module.css';

const editorial = Young_Serif({ subsets: ['latin'], weight: '400', variable: '--font-paper-editorial' });
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Chemistry 0620 paper | Local review',
  robots: { index: false, follow: false },
};

export default async function ChemistryPaperPage({ params }: { params: Promise<{ paperId: string }> }) {
  if (!localChemistryPaperPreviewEnabled()) notFound();
  const { paperId } = await params;
  const paper = await getChemistryPaper(paperId);
  if (!paper) notFound();
  const reader = {
    id: paper.id, title: paper.title, subject: paper.subject, syllabusCode: paper.syllabusCode,
    qualification: 'Cambridge IGCSE', sessionLabel: `${paper.session} ${paper.year}`,
    component: String(paper.paper), paperName: paper.paperName, variant: paper.variant,
    durationMinutes: paper.durationMinutes, maxMarks: paper.maxMarks, sources: paper.sources,
    archiveHref: '/past-papers/igcse-chemistry-0620', reportAvailable: paper.reportAvailable,
  };
  const marking = { id: paper.id, version: paper.version, bankSlug: paper.bankSlug, title: paper.title, maxMarks: paper.maxMarks, questions: paper.questions };
  return <div className={editorial.variable}>
    <PastPaperReader paper={reader} />
    <div className={styles.marking}>
      {paper.reportAvailable ? <PaperMarkingWorkspace paper={marking} /> : <section style={{ padding: '24px 0', borderTop: '1px solid var(--line)' }} aria-label="Marking report unavailable">
        <h2 style={{ fontFamily: 'var(--font-paper-editorial), serif', fontSize: 24 }}>Marking report unavailable</h2>
        <p>{paper.reportReason} You can still read the question paper and matching mark scheme.</p>
      </section>}
    </div>
    <aside style={{ maxWidth: 1200, margin: '24px auto 40px', padding: '16px 24px', borderTop: '1px solid var(--line)', color: 'var(--muted)', fontSize: 12, lineHeight: 1.7 }}>
      <strong>Local review only.</strong> Original question paper and matching mark scheme. Not published or indexed; original-PDF distribution remains subject to rights review.
    </aside>
  </div>;
}
