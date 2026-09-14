import Link from "next/link";
import { ArrowRight, Books, Check, DownloadSimple, FunnelSimple, PencilSimpleLine, Student } from "@phosphor-icons/react/dist/ssr";
import { CourseIcon, type CourseTone } from "@/components/CourseIcon";
import { getAvailableBanks, type Bank } from "@/lib/banks";
import styles from "./MarketingHome.module.css";

type SubjectGroup = {
  name: string;
  tone: CourseTone;
  banks: Bank[];
};

const SUBJECTS: readonly { name: string; tone: CourseTone; matches: (bank: Bank) => boolean }[] = [
  { name: "Mathematics", tone: "math", matches: (bank) => bank.subject.includes("Mathematics") || bank.subject.includes("Additional") },
  { name: "Chemistry", tone: "chemistry", matches: (bank) => bank.subject.includes("Chemistry") },
  { name: "Physics", tone: "physics", matches: (bank) => bank.subject.includes("Physics") },
  { name: "Biology", tone: "biology", matches: (bank) => bank.subject.includes("Biology") },
  { name: "Economics", tone: "economics", matches: (bank) => bank.subject.includes("Economics") },
];

function groupSubjects(banks: readonly Bank[]): SubjectGroup[] {
  return SUBJECTS.map((subject) => ({
    name: subject.name,
    tone: subject.tone,
    banks: banks.filter(subject.matches),
  })).filter((subject) => subject.banks.length > 0);
}

function bankVariant(bank: Bank): string {
  if (bank.qualification === "Cambridge IGCSE") return bank.title.replace("Cambridge IGCSE ", "");
  if (bank.subject.includes("AA")) return bank.subject.includes("HL") ? "AA HL" : "AA SL";
  if (bank.subject.includes("AI")) return bank.subject.includes("HL") ? "AI HL" : "AI SL";
  return bank.subject.includes("HL") ? "HL" : "SL";
}

function BankLink({ bank }: { bank: Bank }) {
  return (
    <Link
      className={styles.bankLink}
      href={`/banks/${bank.slug}?free=1`}
      aria-label={`${bank.shortName}, ${bank.questionCount.toLocaleString()} questions`}
    >
      <span>
        <strong>{bankVariant(bank)}</strong>
        <small>{bank.questionCount.toLocaleString()} questions</small>
        <span className={styles.visuallyHidden}>{bank.title}</span>
      </span>
      <ArrowRight aria-hidden="true" weight="bold" />
    </Link>
  );
}

export function MarketingHome({ environment = process.env }: { environment?: Record<string, string | undefined> }) {
  const banks = getAvailableBanks(environment);
  const cambridgeBanks = banks.filter((bank) => bank.qualification === "Cambridge IGCSE");
  const ibBanks = banks.filter((bank) => bank.qualification === "International Baccalaureate");
  const totalQuestions = banks.reduce((total, bank) => total + bank.questionCount, 0);
  const totalPapers = banks.reduce((total, bank) => total + bank.paperCount, 0);

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <div className={`shell ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Topic-first exam practice</p>
            <h1>Past papers, sorted by topic.</h1>
            <p className={styles.heroLede}>Find the exact questions you need, practise them, and build printable sets.</p>
            <div className={styles.heroActions}>
              <Link className="button primary" href="/dashboard">Start practising <ArrowRight weight="bold" /></Link>
              <Link className="button secondary" href="#question-banks">Browse question banks <ArrowRight weight="bold" /></Link>
            </div>
          </div>
          <figure className={styles.heroMedia} aria-label="Editorial exam study illustration">
            <div className={styles.paperStage} aria-hidden="true">
              <div className={`${styles.paperSheet} ${styles.paperBack}`}><span className={styles.paperRule} /><span className={styles.paperRule} /><span className={styles.paperRule} /></div>
              <div className={`${styles.paperSheet} ${styles.paperFront}`}>
                <span className={styles.paperIndex}>MATH / 0580 / TOPIC 02</span>
                <span className={styles.equation}>f(x) = (x - 2)² - 1</span>
                <svg className={styles.graph} viewBox="0 0 220 130" preserveAspectRatio="none">
                  <path className={styles.graphAxis} d="M10 76H211M50 8V120" />
                  <path className={styles.graphCurve} d="M22 18 C55 38 78 91 110 106 C142 91 165 38 198 18" />
                </svg>
                <span className={styles.checkMark}>✓</span>
                <span className={styles.highlighter} />
              </div>
            </div>
            <figcaption className={styles.mediaCaption}><span>One topic. One method. A focused set.</span></figcaption>
          </figure>
        </div>
      </section>

      <section className={`shell ${styles.banks}`} id="question-banks" aria-labelledby="question-banks-heading">
        <header className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionKicker}>Choose your course</p>
            <h2 id="question-banks-heading">Question banks, clearly grouped.</h2>
          </div>
          <p>Grouped by qualification and subject. Inside each bank, filter by topic, paper, and session. {totalQuestions.toLocaleString()} questions across {totalPapers.toLocaleString()} papers, in {banks.length} banks.</p>
        </header>

        {cambridgeBanks.length > 0 && (
          <section className={styles.catalogSection} aria-labelledby="cambridge-heading">
            <header className={styles.catalogHeader}>
              <div>
                <span className={styles.catalogMark} data-qualification-icon="igcse" aria-hidden="true"><Books weight="duotone" /></span>
                <div><h3 id="cambridge-heading">Cambridge IGCSE</h3><p>Short, clear routes into each subject bank.</p></div>
              </div>
              <span>{cambridgeBanks.length} banks</span>
            </header>
            <div className={styles.cambridgeRows}>
              {groupSubjects(cambridgeBanks).map((subject) => (
                <div className={`${styles.catalogRow} course-tone-${subject.tone}`} key={subject.name}>
                  <div className={styles.subjectHeading}><CourseIcon tone={subject.tone} /><strong>{subject.name}</strong></div>
                  <div className={styles.bankLinks}>{subject.banks.map((bank) => <BankLink bank={bank} key={bank.slug} />)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {ibBanks.length > 0 && (
          <section className={styles.catalogSection} aria-labelledby="ib-heading">
            <header className={styles.catalogHeader}>
              <div>
                <span className={styles.catalogMark} data-qualification-icon="ib" aria-hidden="true"><Student weight="duotone" /></span>
                <div><h3 id="ib-heading">IB Diploma</h3><p>Pick a subject, then move straight into HL or SL.</p></div>
              </div>
              <span>{ibBanks.length} banks</span>
            </header>
            <div className={styles.ibMatrix}>
              {groupSubjects(ibBanks).map((subject) => (
                <div className={`${styles.ibRow} course-tone-${subject.tone}`} key={subject.name}>
                  <div className={styles.subjectHeading}><CourseIcon tone={subject.tone} /><strong>{subject.name}</strong></div>
                  <div className={styles.bankLinks}>{subject.banks.map((bank) => <BankLink bank={bank} key={bank.slug} />)}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>

      <section className={styles.method} aria-labelledby="study-method-heading">
        <div className={`shell ${styles.methodGrid}`}>
          <div className={styles.methodIntro}>
            <p className={styles.sectionKicker}>A better revision loop</p>
            <h2 id="study-method-heading">Simple on purpose. Less hunting through PDFs. More actual practice.</h2>
            <p>Use the original question, with enough structure around it to make the next step obvious.</p>
          </div>
          <div className={styles.methodProof}>
            <div className={styles.proofArtwork} aria-hidden="true"><span className={styles.indexLine}>QUALIFICATION / SUBJECT / BANK</span><strong>E = mc²</strong><span className={styles.proofUnderline} /><span className={styles.proofTick}>✓</span><span className={styles.proofCircle} /></div>
            <ol className={styles.methodSteps}>
              <li><FunnelSimple aria-hidden="true" /><div><strong>Filter</strong><span>Pick a topic, year, paper, or question type.</span></div></li>
              <li><PencilSimpleLine aria-hidden="true" /><div><strong>Practise</strong><span>Work from the original exam question.</span></div></li>
              <li><DownloadSimple aria-hidden="true" /><div><strong>Export</strong><span>Save a focused set or download a clean PDF.</span></div></li>
            </ol>
          </div>
        </div>
      </section>

      <section className={`shell ${styles.cta}`} aria-labelledby="cta-heading">
        <div><p className={styles.sectionKicker}>Your next paper</p><h2 id="cta-heading">Make revision specific.</h2><p>Start free, then unlock more when you need it.</p></div>
        <div className={styles.ctaActions}><Link className="button primary" href="/dashboard">Start practising <ArrowRight weight="bold" /></Link><span className={styles.ctaNote}><Check weight="bold" /> No setup required</span></div>
      </section>
    </div>
  );
}
