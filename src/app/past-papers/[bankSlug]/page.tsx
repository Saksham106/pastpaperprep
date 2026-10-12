import type { Metadata } from 'next';
import { Young_Serif } from 'next/font/google';
import { notFound } from 'next/navigation';
import { getCatalogBank } from '@/lib/catalog';
import { WholePaperBrowser } from '@/components/WholePaperBrowser';
import { getWholePaperSummaries, wholePaperArchiveEnabled, wholePaperPreviewEnabled } from '@/lib/whole-paper-archive';
const editorial=Young_Serif({subsets:['latin'],weight:'400',variable:'--font-paper-editorial'});
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Free past papers | PastPaperPrep',robots:{index:false,follow:false}};
export default async function WholePaperBank({params}:{params:Promise<{bankSlug:string}>}) {
  if(!await wholePaperArchiveEnabled()) notFound();
  const {bankSlug}=await params;
  const bank=getCatalogBank(bankSlug);
  if(!bank) notFound();
  return <div className={editorial.variable}><WholePaperBrowser bank={bank} papers={await getWholePaperSummaries(bankSlug)} localPreview={wholePaperPreviewEnabled()}/></div>;
}
