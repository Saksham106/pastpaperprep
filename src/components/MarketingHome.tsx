import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, DownloadSimple, FunnelSimple, PencilSimpleLine } from "@phosphor-icons/react/dist/ssr";
import type { Bank } from "@/lib/banks";
import { getCatalogRuntimeBanks } from "@/lib/catalog";
import { CourseIcon, type CourseTone } from "@/components/CourseIcon";
import { QualificationTabs } from "@/components/QualificationTabs";
import styles from "./MarketingHome.module.css";

type SubjectGroup = { name: string; tone: CourseTone; banks: Bank[] };
const SUBJECTS: readonly { name: string; tone: CourseTone; matches: (bank: Bank) => boolean }[] = [
  { name: "Mathematics", tone: "math", matches: (bank) => bank.subject.includes("Mathematics") || bank.subject.includes("Additional") },
  { name: "Chemistry", tone: "chemistry", matches: (bank) => bank.subject.includes("Chemistry") },
  { name: "Physics", tone: "physics", matches: (bank) => bank.subject.includes("Physics") },
  { name: "Biology", tone: "biology", matches: (bank) => bank.subject.includes("Biology") },
  { name: "Economics", tone: "economics", matches: (bank) => bank.subject.includes("Economics") },
];
function groupSubjects(banks: readonly Bank[]): SubjectGroup[] { return SUBJECTS.map((s) => ({ name: s.name, tone: s.tone, banks: banks.filter(s.matches) })).filter((s) => s.banks.length > 0); }
function CatalogPanel({ banks }: { banks: readonly Bank[] }) {
  const groups = groupSubjects(banks);
  return <section className={styles.catalog} aria-label="Question banks"><div className={styles.subjectGrid}>{groups.map((group) => {
    const bankCount = group.banks.length;
    const bankLayout = bankCount === 1 ? styles.bankCardsSingle : bankCount === 2 ? styles.bankCardsTwo : styles.bankCardsMany;
    return <section className={`${styles.subjectGroup} course-tone-${group.tone}`} data-subject-tone={group.tone} key={group.name}>
      <div className={styles.subjectContent}><header><span className={styles.subjectHeading}><CourseIcon tone={group.tone} /><h4>{group.name}</h4></span></header><div className={`${styles.bankCards} ${bankLayout}`} data-bank-count={bankCount}>{group.banks.map((bank) => <Link className={styles.bankCard} href={`/banks/${bank.slug}?free=1`} key={bank.slug}><span className={styles.bankCardCopy}><strong>{bank.shortName}</strong><span className={styles.bankChips}><span>{bank.questionCount.toLocaleString()} questions</span></span></span></Link>)}</div></div>
      <span className={styles.subjectWatermark} data-subject-watermark="true" aria-hidden="true"><CourseIcon tone={group.tone} /></span>
    </section>;
  })}</div></section>;
}

export function MarketingHome({ environment = process.env }: { environment?: Record<string, string | undefined> }) {
  const banks = getCatalogRuntimeBanks(environment);
  const cambridgeBanks = banks.filter((bank) => bank.qualification === "Cambridge IGCSE");
  const ibBanks = banks.filter((bank) => bank.qualification === "International Baccalaureate");
  const totalQuestions = banks.reduce((total, bank) => total + bank.questionCount, 0);
  const totalPapers = banks.reduce((total, bank) => total + bank.paperCount, 0);
  return <div className={`${styles.home} landing-editorial`}>
    <section className={styles.hero}>
      <div className={styles.heroArtwork} aria-hidden="true"><Image className={styles.heroBuilding} src="/artwork/georgetown-1829.jpg" alt="" width={1280} height={771} priority /><Image className={styles.heroBotanical} src="/artwork/atkins-spiraea.jpg" alt="" width={444} height={624} priority /></div>
      <div className={`shell ${styles.heroStage}`}>
        <div className={styles.heroCopy}><p className={styles.eyebrow}>PastPaperPrep</p><h1>Practice the<br /><em>topics you need.</em></h1><div className={styles.heroActions}><Link className="button primary" href="#question-banks">Choose your course <ArrowRight weight="bold" /></Link><Link className="button secondary" href="#workflow">See how it works <ArrowRight weight="bold" /></Link></div></div>
        <div className={styles.heroIndex}><span>Question archive</span><strong>{totalQuestions.toLocaleString()}</strong><small>questions across {totalPapers.toLocaleString()} papers</small><span className={styles.visuallyHidden}>{totalQuestions.toLocaleString()} questions across {totalPapers.toLocaleString()} papers in {banks.length} banks.</span></div>
      </div>
    </section>

    <section className={`shell ${styles.banks}`} id="question-banks" aria-labelledby="question-banks-heading"><header className={styles.sectionHeader}><p className={styles.sectionKicker}>The collection</p><h2 id="question-banks-heading">Choose where to begin.</h2><p>Qualification first. Subject second. Then a bank of real questions, ready to work through.</p></header><QualificationTabs items={[...(cambridgeBanks.length > 0 ? [{ id: "cambridge-catalog", label: "Cambridge IGCSE", panel: <CatalogPanel banks={cambridgeBanks} /> }] : []), ...(ibBanks.length > 0 ? [{ id: "ib-catalog", label: "IB Diploma", panel: <CatalogPanel banks={ibBanks} /> }] : [])]} /></section>

    <section className={styles.workflow} id="workflow" aria-labelledby="workflow-heading"><div className={`shell ${styles.workflowGrid}`}><div className={styles.workflowIntro}><p className={styles.sectionKicker}>A better revision loop</p><h2 id="workflow-heading">From topic to finished practice set.</h2><p>Stay close to the syllabus and the source paper. Nothing invented, nothing extra.</p></div><ol className={styles.workflowList}><li><FunnelSimple aria-hidden="true" /><div><strong>Select a topic</strong><span>Start with the syllabus point you need to strengthen.</span></div></li><li><PencilSimpleLine aria-hidden="true" /><div><strong>Solve real questions</strong><span>Work through exam questions chosen for that exact topic.</span></div></li><li><DownloadSimple aria-hidden="true" /><div><strong>Keep the mark scheme close</strong><span>Download the questions and mark scheme together as a clean PDF.</span></div></li></ol></div></section>
    <section className={`shell ${styles.cta}`} aria-labelledby="cta-heading"><div><p className={styles.sectionKicker}>Begin with one topic</p><h2 id="cta-heading">Make revision specific.</h2></div><div className={styles.ctaActions}><Link className="button primary" href="#question-banks">Choose your course <ArrowRight weight="bold" /></Link><span className={styles.ctaNote}><Check weight="bold" /> No setup required</span></div><Image className={styles.ctaArtwork} src="/artwork/flegel-study.jpg" alt="Botanical study from the Flegel collection" width={1280} height={771} /></section>
  </div>;
}
