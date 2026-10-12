import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PastPaperHub } from '@/components/past-papers/PastPaperHub';
import { PastPaperListPage } from '@/components/past-papers/PastPaperListPage';
import type { PastPaperQualification } from '@/lib/past-paper-catalog';
import { hubBanks, pastPaperParams, resolveSubject } from '@/lib/past-paper-pages';
import { hubCopy, subjectCopy } from '@/lib/past-paper-seo';

export const dynamicParams = false;
export async function generateStaticParams() { return (await pastPaperParams()).slugs.map(slug => ({ slug })); }
const qualification = (slug: string): PastPaperQualification | null => slug === 'igcse' || slug === 'ib' ? slug : null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const q = qualification(slug);
  const copy = q ? hubCopy((await hubBanks(q)).reduce((n, b) => n + b.paperCount, 0), q) : await resolveSubject(slug).then(s => s && subjectCopy(s.bank, s.papers));
  if (!copy) return {};
  const path = `/past-papers/${slug}`;
  return { title: copy.title, description: copy.description, alternates: { canonical: path }, openGraph: { url: path, title: copy.title, description: copy.description } };
}

export default async function PastPaperSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const q = qualification(slug);
  if (q) {
    const banks = await hubBanks(q);
    if (!banks.length) notFound();
    return <PastPaperHub banks={banks} qualification={q} />;
  }
  const subject = await resolveSubject(slug);
  if (!subject) notFound();
  return <PastPaperListPage view={subject} />;
}
