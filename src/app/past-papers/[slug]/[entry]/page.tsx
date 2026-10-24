import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PastPaperListPage } from '@/components/past-papers/PastPaperListPage';
import { PastPaperPaperPage } from '@/components/past-papers/PastPaperPaperPage';
import { qualificationOfBank } from '@/lib/past-paper-catalog';
import { pastPaperParams, resolveEntry } from '@/lib/past-paper-pages';
import { paperCopy, paperNumberCopy, pastPaperMetadata, yearCopy } from '@/lib/past-paper-seo';

export const dynamicParams = false;
export async function generateStaticParams() { return (await pastPaperParams()).entries; }

export async function generateMetadata({ params }: { params: Promise<{ slug: string; entry: string }> }): Promise<Metadata> {
  const { slug, entry } = await params;
  const view = await resolveEntry(slug, entry);
  if (!view) return {};
  const copy = view.kind === 'year' ? yearCopy(view.bank, view.year, view.papers) : view.kind === 'paperNumber' ? paperNumberCopy(view.bank, view.paper, view.papers) : paperCopy(view.bank, view.detail.summary);
  return pastPaperMetadata(copy, `/past-papers/${slug}/${entry}`, qualificationOfBank(view.bank.slug));
}

export default async function PastPaperEntryPage({ params }: { params: Promise<{ slug: string; entry: string }> }) {
  const { slug, entry } = await params;
  const view = await resolveEntry(slug, entry);
  if (!view) notFound();
  return view.kind === 'paper' ? <PastPaperPaperPage view={view} /> : <PastPaperListPage view={view} />;
}
