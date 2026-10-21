import Link from 'next/link';
import { ArrowRight, CaretDown, FileText, Target, Timer } from '@phosphor-icons/react/dist/ssr';
import { CourseIcon, type CourseTone } from '@/components/CourseIcon';
import { JsonLd } from '@/components/JsonLd';
import type { PastPaperQualification } from '@/lib/past-paper-catalog';
import type { HubBank } from '@/lib/past-paper-pages';
import { breadcrumbJsonLd, collectionJsonLd, faqJsonLd, hubCopy, hubFaq } from '@/lib/past-paper-seo';
import { PaperFinder } from './PaperFinder';
import { ScopeSwitch } from './ScopeSwitch';
import { formatUpdateDate, lastUpdated } from '@/lib/updates';
import styles from './PastPaperPages.module.css';

const GROUPS: [CourseTone, string][] = [['math', 'Mathematics'], ['chemistry', 'Chemistry'], ['physics', 'Physics'], ['biology', 'Biology'], ['coordinated', 'Co-ordinated Sciences'], ['economics', 'Economics'], ['computer-science', 'Computer Science']];
const SCOPES: [string, string, PastPaperQualification | undefined][] = [['All', '/past-papers', undefined], ['IGCSE', '/past-papers/igcse', 'igcse'], ['IB', '/past-papers/ib', 'ib']];
const QUALIFICATION_NAME = { igcse: 'Cambridge IGCSE', ib: 'IB' } as const;
const GUIDE = {
  igcse: {
    title: 'How Cambridge IGCSE papers are named',
    body: 'Cambridge sits IGCSE exams in three series: February/March, May/June and October/November. Each paper has a code like 0580/42/M/J/24: syllabus 0580, Paper 4 variant 2, May/June 2024. Cambridge\'s files use the same facts as 0580_s24_qp_42 for the question paper and 0580_s24_ms_42 for the mark scheme. Search either form above to find a paper.',
  },
  ib: {
    title: 'How IB papers are organised',
    body: 'IB Diploma exams run in May and November. Each subject has separate Higher Level and Standard Level papers, numbered Paper 1, Paper 2 and so on, and many sessions have time-zone versions marked TZ1 and TZ2, each with its own markscheme. Pick your subject above, then search a session and paper on its page, like "May 2024 paper 1 TZ1".',
  },
} as const;

export function PastPaperHub({ banks, qualification }: { banks: HubBank[]; qualification?: PastPaperQualification }) {
  const copy = hubCopy(banks.reduce((n, b) => n + b.paperCount, 0), qualification);
  const path = qualification ? `/past-papers/${qualification}` : '/past-papers';
  const crumbs = [{ name: 'Past papers', path: '/past-papers' }, ...(qualification ? [{ name: QUALIFICATION_NAME[qualification], path }] : [])];
  const faq = qualification ? hubFaq(qualification) : [];
  const updated = lastUpdated(qualification ? banks.map(b => `/past-papers/${b.subjectSlug}`) : ['/past-papers']);
  return <article className={styles.page}>
    <JsonLd data={breadcrumbJsonLd(crumbs)} />
    <JsonLd data={collectionJsonLd(copy, path, banks.map(b => ({ name: `${b.name} past papers`, path: `/past-papers/${b.subjectSlug}` })))} />
    {faq.length > 0 && <JsonLd data={faqJsonLd(faq)} />}
    {qualification && <nav aria-label="Breadcrumb" className={styles.crumbs}><Link href="/past-papers">Past papers</Link><span aria-hidden="true">/</span><span>{QUALIFICATION_NAME[qualification]}</span></nav>}
    <header className={styles.hubHead}>
      <h1>{copy.h1}</h1>
      <p>{copy.answer}</p>
      {updated && <p className={styles.updated}>Updated <time dateTime={updated}>{formatUpdateDate(updated)}</time></p>}
      <div className={styles.hubFind}>
        <ScopeSwitch scopes={SCOPES.map(([label, href]) => ({ label, href }))} current={SCOPES.findIndex(([, , scope]) => scope === qualification)} />
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
    {qualification && <section className={styles.faq} aria-labelledby="hub-overview">
      <h2 id="hub-overview">{QUALIFICATION_NAME[qualification]} subjects</h2>
      <p>{banks.map(b => `${b.name} (${b.paperCount.toLocaleString('en-US')} papers, ${b.years})`).join(' · ')}. Every paper opens free with its {qualification === 'ib' ? 'markscheme' : 'mark scheme'}; most also have a timer and self-marking.</p>
      <h2>{GUIDE[qualification].title}</h2>
      <p>{GUIDE[qualification].body}</p>
    </section>}
    {qualification && <Link className={styles.practice} href="/#question-banks">Practise past-paper questions by topic instead <ArrowRight aria-hidden="true" weight="bold" /></Link>}
    {faq.length > 0 && <section className={styles.faq} aria-labelledby="hub-faq">
      <h2 id="hub-faq">Questions</h2>
      {faq.map(item => <details key={item.q}><summary>{item.q}<CaretDown aria-hidden="true" /></summary><p>{item.a}</p></details>)}
    </section>}
    <section className={styles.why} aria-label="Why use these papers">
      <div><FileText aria-hidden="true" weight="bold" /><h2>Questions and answers together</h2><p>Question paper and mark scheme, one tap apart.</p></div>
      <div><Timer aria-hidden="true" weight="bold" /><h2>Real exam timing</h2><p>A timer set to the paper&apos;s real duration.</p></div>
      <div><Target aria-hidden="true" weight="bold" /><h2>Know what to fix</h2><p>Mark it and see which topics cost you marks.</p></div>
    </section>
  </article>;
}
