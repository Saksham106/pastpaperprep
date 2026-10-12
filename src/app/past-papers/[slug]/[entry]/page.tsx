import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PastPaperListPage } from '@/components/past-papers/PastPaperListPage';
import { PastPaperPaperPage } from '@/components/past-papers/PastPaperPaperPage';
import { pastPaperParams, resolveEntry } from '@/lib/past-paper-pages';
import { paperCopy, paperNumberCopy, yearCopy } from '@/lib/past-paper-seo';

export const dynamicParams = false;
export async function generateStaticParams() { return (await pastPaperParams()).entries; }

export async function generateMetadata({ params }: { params: Promise<{ slug: string; entry: string }> }): Promise<Metadata> {
  const { slug, entry } = await params;
  const view = await resolveEntry(slug, entry);
  if (!view) return {};
  const copy = view.kind === 'year' ? yearCopy(view.bank, view.year, view.papers) : view.kind === 'paperNumber' ? paperNumberCopy(view.bank, view.paper, view.papers) : paperCopy(view.bank, view.detail.summary);
  const path = `/past-papers/${slug}/${entry}`;
  return { title: copy.title, description: copy.description, alternates: { canonical: path }, openGraph: { url: path, title: copy.title, description: copy.description } };
}

export default async function PastPaperEntryPage({ params }: { params: Promise<{ slug: string; entry: string }> }) {
  const { slug, entry } = await params;
  const view = await resolveEntry(slug, entry);
  if (!view) notFound();
  return view.kind === 'paper' ? <PastPaperPaperPage view={view} /> : <PastPaperListPage view={view} />;
}
