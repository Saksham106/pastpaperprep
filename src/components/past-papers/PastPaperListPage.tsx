import Link from 'next/link';
import { ArrowLeft, ArrowRight, CaretDown } from '@phosphor-icons/react/dist/ssr';
import { CourseIcon, courseToneForBank } from '@/components/CourseIcon';
import { JsonLd } from '@/components/JsonLd';
import { buildPaperMatrix, paperHref, paperName, qualificationOfBank, subjectSlugForBank } from '@/lib/past-paper-catalog';
import type { ListView } from '@/lib/past-paper-pages';
import { breadcrumbJsonLd, collectionJsonLd, faqJsonLd, paperNumberCopy, subjectCopy, subjectFaq, subjectSearchName, yearCopy } from '@/lib/past-paper-seo';
import { PaperLibraryTools } from './PaperLibraryTools';
import { getGradeThresholds } from '@/lib/grade-thresholds';
import { getNotesSubject } from '@/lib/revision-notes';
import { formatUpdateDate, lastUpdated } from '@/lib/updates';
import styles from './PastPaperPages.module.css';

const QUALIFICATION = { igcse: { name: 'Cambridge IGCSE', path: '/past-papers/igcse' }, ib: { name: 'IB', path: '/past-papers/ib' } } as const;

/** Subject, year and paper-number pages share one shell: answer first, then the matrix, then links. */
export function PastPaperListPage({ view }: { view: ListView }) {
  const { bank } = view;
  const all = view.kind === 'subject' ? view.papers : view.all;
  const subject = subjectSlugForBank(bank.slug);
  const subjectPath = `/past-papers/${subject}`;
  const name = subjectSearchName(bank);
  const tone = courseToneForBank(bank);
  const copy = view.kind === 'subject' ? subjectCopy(bank, view.papers) : view.kind === 'year' ? yearCopy(bank, view.year, view.papers) : paperNumberCopy(bank, view.paper, view.papers);
  const here = view.kind === 'year' ? { name: String(view.year), path: `${subjectPath}/${view.year}` } : view.kind === 'paperNumber' ? { name: `Paper ${view.paper.toUpperCase()}`, path: `${subjectPath}/paper-${view.paper.toLowerCase()}` } : null;
  const qualification = QUALIFICATION[qualificationOfBank(bank.slug)];
  const crumbs = [{ name: 'Past papers', path: '/past-papers' }, qualification, { name, path: subjectPath }, ...(here ? [here] : [])];
  const years = [...new Set(all.map(p => p.year))].sort((a, b) => b - a);
  const columns = buildPaperMatrix(all, subject).columns;
  const faq = view.kind === 'subject' ? subjectFaq(bank, view.papers) : [];
  const updated = lastUpdated([here?.path ?? subjectPath]);
  const previous = view.kind === 'year' ? years.find(y => y < view.year) : undefined;
  const next = view.kind === 'year' ? [...years].reverse().find(y => y > view.year) : undefined;
  const listed = [...view.papers].sort((a, b) => b.year - a.year).slice(0, 100).map(p => ({ name: `${paperName(p)}, ${p.session} ${p.year}`, path: paperHref(p) }));
  return <article className={styles.page} data-subject-tone={tone}>
    <JsonLd data={breadcrumbJsonLd(crumbs)} />
    <JsonLd data={collectionJsonLd(copy, here?.path ?? subjectPath, listed)} />
    {faq.length > 0 && <JsonLd data={faqJsonLd(faq)} />}
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <Link href="/past-papers">Past papers</Link><span aria-hidden="true">/</span>
      <Link href={qualification.path}>{qualification.name}</Link><span aria-hidden="true">/</span>
      {here ? <><Link href={subjectPath}>{name}</Link><span aria-hidden="true">/</span><span>{here.name}</span></> : <span>{name}</span>}
    </nav>
    <header className={styles.listHead}>
      <span className={styles.iconTile}><CourseIcon tone={tone} /></span>
      <h1>{copy.h1}</h1>
      <p>{copy.answer}</p>
      {updated && <p className={styles.updated}>Updated <time dateTime={updated}>{formatUpdateDate(updated)}</time></p>}
    </header>
    <PaperLibraryTools data={buildPaperMatrix(view.papers, subject)} papers={all} />
    {view.kind === 'year' && <nav aria-label="Neighbouring years" className={styles.pager}>
      {previous ? <Link href={`${subjectPath}/${previous}`}><ArrowLeft aria-hidden="true" /><span>Previous year: {previous}</span></Link> : <span />}
      {next ? <Link href={`${subjectPath}/${next}`}><span>Next year: {next}</span><ArrowRight aria-hidden="true" /></Link> : <span />}
    </nav>}
    <div className={styles.browse}>
      <nav aria-label="Browse by year"><h2>Browse by year</h2><div>{years.map(y => <Link key={y} href={`${subjectPath}/${y}`} aria-current={view.kind === 'year' && view.year === y ? 'page' : undefined}>{y}</Link>)}</div></nav>
      <nav aria-label="Browse by paper"><h2>Browse by paper</h2><div>{columns.map(c => <Link key={c.paper} href={c.href} aria-current={view.kind === 'paperNumber' && view.paper === c.paper ? 'page' : undefined}>{c.label}{c.note && <small>{c.note}</small>}</Link>)}</div></nav>
    </div>
    {view.practice && <Link className={styles.practice} href={`/banks/${bank.slug}`}>Practise {name} questions by topic <ArrowRight aria-hidden="true" weight="bold" /></Link>}
    {getGradeThresholds(subject) && <Link className={styles.practice} href={`/grade-thresholds/${subject}`}>{name} grade thresholds <ArrowRight aria-hidden="true" weight="bold" /></Link>}
    {getNotesSubject(subject) && <Link className={styles.practice} href={`/revision-notes/${subject}`}>{name} revision notes <ArrowRight aria-hidden="true" weight="bold" /></Link>}
    {faq.length > 0 && <section className={styles.faq} aria-labelledby="past-paper-faq">
      <h2 id="past-paper-faq">Questions</h2>
      {faq.map(item => <details key={item.q}><summary>{item.q}<CaretDown aria-hidden="true" /></summary><p>{item.a}</p></details>)}
    </section>}
  </article>;
}
