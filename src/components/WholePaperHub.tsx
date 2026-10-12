import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import type { WholePaperBankSummary } from '@/lib/whole-paper-types';
import styles from './WholePaperHub.module.css';

export function WholePaperHub({ banks, localPreview = true }: { banks: readonly WholePaperBankSummary[]; localPreview?: boolean }) {
  const paperCount = banks.reduce((sum,bank)=>sum+bank.paperCount,0);
  const reportCount = banks.reduce((sum,bank)=>sum+bank.reportCount,0);
  const qualifications = [...new Set(banks.map(b=>b.qualification))];
  return <article className={styles.hub}>
    <nav aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Free past papers</span></nav>
    <header><p className={styles.kicker}>The whole-paper workspace</p><h1>Past papers.<br/>Better practice.</h1><p className={styles.lede}>Find the right paper. Set a timer. Mark your attempt.<br/>Know what to practise next.</p><div className={styles.facts}><span>{banks.length} banks</span><span>{paperCount.toLocaleString('en-US')} paired papers</span><span>{reportCount.toLocaleString('en-US')} revision reports available</span></div></header>
    <div className={styles.explainer}><span>01 <strong>Choose a paper</strong></span><span>02 <strong>Attempt & self-mark</strong></span><span>03 <strong>Get targeted revision</strong></span></div>
    {qualifications.map(qualification=><section className={styles.section} key={qualification}><h2>{qualification}</h2><div className={styles.banks}>{banks.filter(bank=>bank.qualification===qualification).map(bank=><Link key={bank.bankSlug} href={`/past-papers/${bank.bankSlug}`} className={styles.bank} aria-label={`Browse ${bank.title} past papers`}><div><p>{bank.syllabusCode}{bank.level ? ` · ${bank.level}` : ''}</p><h3>{bank.title}</h3><span>{bank.available ? `${bank.paperCount.toLocaleString('en-US')} papers · ${bank.years}` : 'Original source pairs unavailable'}</span></div><div className={styles.action}><span>{bank.reportCount ? `${bank.reportCount} with revision reports` : 'PDF discovery'} </span><ArrowRight aria-hidden="true"/></div></Link>)}</div></section>)}
    <aside className={styles.note}>Full papers and available self-marking reports are free. Topic practice and custom worksheets are the next step—not a gate to reading a paper.{localPreview && <p><strong>Local preview.</strong> Source originals have not been published. Unavailable reports and unverified metadata are labelled per paper.</p>}</aside>
  </article>;
}
