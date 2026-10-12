import type { Metadata } from 'next';
import { Young_Serif } from 'next/font/google';
import { notFound } from 'next/navigation';
import { getCatalogBank } from '@/lib/catalog';
import { PastPaperReader } from '@/components/PastPaperReader';
import { PaperMarkingWorkspace } from '@/components/PaperMarkingWorkspace';
import { getWholePaper, wholePaperArchiveEnabled, wholePaperPreviewEnabled } from '@/lib/whole-paper-archive';
import styles from '../../preview/page.module.css';
const editorial=Young_Serif({subsets:['latin'],weight:'400',variable:'--font-paper-editorial'});
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Past-paper practice | PastPaperPrep',robots:{index:false,follow:false}};
export default async function WholePaperPage({params}:{params:Promise<{bankSlug:string;paperId:string}>}) {
  if(!await wholePaperArchiveEnabled()) notFound();
  const {bankSlug,paperId}=await params;
  const bank=getCatalogBank(bankSlug);
  if(!bank) notFound();
  const detail=await getWholePaper(bankSlug,paperId);
  if(!detail) notFound();
  const p=detail.summary;
  const reader={id:`${p.bankSlug}:${p.id}`,title:p.title,subject:p.subject,syllabusCode:p.syllabusCode,qualification:p.qualification,sessionLabel:`${p.session} ${p.year}`,component:p.paper,paperName:p.route && p.route!=='Shared' ? `${bank.subject} · ${p.route}` : bank.subject,variant:p.variant,durationMinutes:p.durationMinutes,maxMarks:p.maxMarks,sources:detail.sources,archiveHref:`/past-papers/${bankSlug}`,bankSlug,reportAvailable:p.reportAvailable};
  return <div className={editorial.variable}><PastPaperReader paper={reader}/><div className={styles.marking}>{p.reportAvailable && p.maxMarks !== null ? <PaperMarkingWorkspace paper={{id:p.id,version:detail.version,bankSlug,title:p.title,maxMarks:p.maxMarks,questions:detail.questions}}/> : <section aria-label="Marking report unavailable" style={{padding:'24px 0',borderTop:'1px solid var(--line)'}}><h2 style={{fontFamily:'var(--font-paper-editorial),serif',fontSize:24}}>Marking report unavailable</h2><p>{p.reportReason ?? 'Source scoring metadata needs review.'} You can still use the question paper and matching mark scheme.</p></section>}</div>{wholePaperPreviewEnabled() && <aside style={{maxWidth:1132,margin:'24px auto 40px',padding:'16px 24px',borderTop:'1px solid var(--line)',color:'var(--muted)',fontSize:12,lineHeight:1.7}}><strong>Local review only.</strong> These original documents have not been published.</aside>}</div>;
}
