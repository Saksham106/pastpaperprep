import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import type { BankSlug } from '@/lib/catalog';
import { paperNumberSlug, subjectSlugForBank } from '@/lib/past-paper-catalog';
import { pastPaperLinksEnabled } from '@/lib/past-paper-nav';

/** From a bank's "Paper N questions" page to every full Paper N with its mark scheme. */
export function FullPapersLink({ bankSlug, paper }: { bankSlug: BankSlug; paper: number | string }) {
  if (!pastPaperLinksEnabled()) return null;
  return <Link className="text-button" href={`/past-papers/${subjectSlugForBank(bankSlug)}/${paperNumberSlug(String(paper))}`}>Full Paper {String(paper).toUpperCase()} past papers with mark schemes <ArrowRight weight="bold" aria-hidden="true" /></Link>;
}
