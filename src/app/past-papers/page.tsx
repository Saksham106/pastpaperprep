import type { Metadata } from 'next';
import { Young_Serif } from 'next/font/google';
import { notFound } from 'next/navigation';
import { WholePaperHub } from '@/components/WholePaperHub';
import { getWholePaperBanks, wholePaperArchiveEnabled, wholePaperPreviewEnabled } from '@/lib/whole-paper-archive';
const editorial = Young_Serif({subsets:['latin'],weight:'400',variable:'--font-paper-editorial'});
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title:'Free past-paper practice | PastPaperPrep',robots:{index:false,follow:false}};
export default async function WholePaperLibrary() {
  if (!await wholePaperArchiveEnabled()) notFound();
  return <div className={editorial.variable}><WholePaperHub banks={await getWholePaperBanks()} localPreview={wholePaperPreviewEnabled()}/></div>;
}
