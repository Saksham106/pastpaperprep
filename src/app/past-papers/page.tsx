import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PastPaperHub } from '@/components/past-papers/PastPaperHub';
import { hubBanks } from '@/lib/past-paper-pages';
import { hubCopy } from '@/lib/past-paper-seo';

export async function generateMetadata(): Promise<Metadata> {
  const copy = hubCopy((await hubBanks()).reduce((n, b) => n + b.paperCount, 0));
  return { title: copy.title, description: copy.description, alternates: { canonical: '/past-papers' }, openGraph: { url: '/past-papers', title: copy.title, description: copy.description } };
}

export default async function PastPapersHub() {
  const banks = await hubBanks();
  if (!banks.length) notFound();
  return <PastPaperHub banks={banks} />;
}
