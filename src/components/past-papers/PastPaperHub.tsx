import Link from 'next/link';
import { ArrowRight, FileText, Target, Timer } from '@phosphor-icons/react/dist/ssr';
import { CourseIcon, type CourseTone } from '@/components/CourseIcon';
import { JsonLd } from '@/components/JsonLd';
import type { PastPaperQualification } from '@/lib/past-paper-catalog';
import type { HubBank } from '@/lib/past-paper-pages';
import { breadcrumbJsonLd, collectionJsonLd, hubCopy } from '@/lib/past-paper-seo';
import { PaperFinder } from './PaperFinder';
import styles from './PastPaperPages.module.css';

const GROUPS: [CourseTone, string][] = [['math', 'Mathematics'], ['chemistry', 'Chemistry'], ['physics', 'Physics'], ['biology', 'Biology'], ['coordinated', 'Co-ordinated Sciences'], ['economics', 'Economics']];
const SCOPES: [string, string, PastPaperQualification | undefined][] = [['All', '/past-papers', undefined], ['IGCSE', '/past-papers/igcse', 'igcse'], ['IB', '/past-papers/ib', 'ib']];
const QUALIFICATION_NAME = { igcse: 'Cambridge IGCSE', ib: 'IB' } as const;

export function PastPaperHub({ banks, qualification }: { banks: HubBank[]; qualification?: PastPaperQualification }) {
  const copy = hubCopy(banks.reduce((n, b) => n + b.paperCount, 0), qualification);
  const path = qualification ? `/past-papers/${qualification}` : '/past-papers';
  const crumbs = [{ name: 'Past papers', path: '/past-papers' }, ...(qualification ? [{ name: QUALIFICATION_NAME[qualification], path }] : [])];
  return <article className={styles.page}>
    <JsonLd data={breadcrumbJsonLd(crumbs)} />
    <JsonLd data={collectionJsonLd(copy, path, banks.map(b => ({ name: `${b.name} past papers`, path: `/past-papers/${b.subjectSlug}` })))} />
    {qualification && <nav aria-label="Breadcrumb" className={styles.crumbs}><Link href="/past-papers">Past papers</Link><span aria-hidden="true">/</span><span>{QUALIFICATION_NAME[qualification]}</span></nav>}
    <header className={styles.hubHead}>
      <h1>{copy.h1}</h1>
      <p>{copy.answer}</p>
      <div className={styles.hubFind}>
        <nav aria-label="Qualification" className={styles.scopes}>{SCOPES.map(([label, href, scope]) => <Link key={href} href={href} aria-current={scope === qualification ? 'page' : undefined}>{label}</Link>)}</nav>
        <PaperFinder mode="subjects" subjects={banks.map(b => ({ name: b.name, code: /\b(0\d{3})$/.exec(b.name)?.[1] ?? '', href: `/past-papers/${b.subjectSlug}` }))} />
      </div>
    </header>
    <div className={styles.subjectGrid}>{GROUPS.map(([tone, name]) => {
      const group = banks.filter(b => b.tone === tone);
      return group.length > 0 && <section key={tone} className={styles.subjectCard} data-subject-tone={tone} aria-label={name}>
        <header className={styles.subjectHead}><h2>{name}</h2><span className={styles.subjectMark}><CourseIcon tone={tone} /></span></header>
        <div className={styles.bankRows}>{group.map(b => <Link key={b.bankSlug} className={styles.bankRow} href={`/past-papers/${b.subjectSlug}`}>
          <strong>{b.name}</strong><span>{b.paperCount.toLocaleString('en-US')} papers</span><ArrowRight aria-hidden="true" weight="bold" />
        </Link>)}</div>
      </section>;
    })}</div>
    <section className={styles.why} aria-label="Why use these papers">
      <div><FileText aria-hidden="true" weight="bold" /><h2>Questions and answers together</h2><p>Question paper and mark scheme, one tap apart.</p></div>
      <div><Timer aria-hidden="true" weight="bold" /><h2>Real exam timing</h2><p>A timer set to the paper&apos;s real duration.</p></div>
      <div><Target aria-hidden="true" weight="bold" /><h2>Know what to fix</h2><p>Mark it and see which topics cost you marks.</p></div>
    </section>
  </article>;
}
