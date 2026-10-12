import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PastPaperHub } from '@/components/past-papers/PastPaperHub';
import { hubBanks } from '@/lib/past-paper-pages';
import { hubCopy, pastPaperMetadata } from '@/lib/past-paper-seo';

export async function generateMetadata(): Promise<Metadata> {
  const copy = hubCopy((await hubBanks()).reduce((n, b) => n + b.paperCount, 0));
  return pastPaperMetadata(copy, '/past-papers');
}

export default async function PastPapersHub() {
  const banks = await hubBanks();
  if (!banks.length) notFound();
  return <PastPaperHub banks={banks} />;
}
