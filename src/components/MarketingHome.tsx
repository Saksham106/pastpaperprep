import Link from "next/link";
import { ArrowRight, Books, DownloadSimple, FunnelSimple, PencilSimpleLine, Student } from "@phosphor-icons/react/dist/ssr";
import { CourseIcon, type CourseTone } from "@/components/CourseIcon";
import { getAvailableBanks, type Bank } from "@/lib/banks";
import styles from "./MarketingHome.module.css";

type SubjectGroup = {
  name: string;
  tone: CourseTone;
  banks: Bank[];
};

const SUBJECTS: readonly { name: string; tone: CourseTone; matches: (bank: Bank) => boolean }[] = [
  { name: "Mathematics", tone: "math", matches: (bank) => bank.subject.includes("Mathematics") },
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
  if (bank.qualification === "Cambridge IGCSE") return bank.title;
  if (bank.subject.includes("AA")) return bank.subject.includes("HL") ? "AA HL" : "AA SL";
  if (bank.subject.includes("AI")) return bank.subject.includes("HL") ? "AI HL" : "AI SL";
  return bank.subject.includes("HL") ? "HL" : "SL";
}

export function MarketingHome({ environment = process.env }: { environment?: Record<string, string | undefined> }) {
  const banks = getAvailableBanks(environment);
  const qualifications = [
    {
      name: "Cambridge IGCSE",
      icon: Books,
      iconName: "igcse",
      subjects: groupSubjects(banks.filter((bank) => bank.qualification === "Cambridge IGCSE")),
    },
    {
      name: "IB Diploma",
      icon: Student,
      iconName: "ib",
      subjects: groupSubjects(banks.filter((bank) => bank.qualification === "International Baccalaureate")),
    },
  ].filter((qualification) => qualification.subjects.length > 0);
  const totalQuestions = banks.reduce((total, bank) => total + bank.questionCount, 0);
  const totalPapers = banks.reduce((total, bank) => total + bank.paperCount, 0);

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <div className="shell">
          <p className={styles.eyebrow}>Topic-first exam practice</p>
          <h1>Past papers, sorted by topic.</h1>
          <p className={styles.heroLede}>Find the exact questions you need, practise them, and build printable sets.</p>
          <div className={styles.heroActions}>
            <Link className="button primary" href="/dashboard">Start practising <ArrowRight weight="bold" /></Link>
            <Link className="button secondary" href="#question-banks">Browse banks <ArrowRight weight="bold" /></Link>
          </div>
          <p className={styles.coverage}>{totalQuestions.toLocaleString()} questions · {totalPapers.toLocaleString()} papers · {banks.length} banks</p>
          <svg className={styles.heroDoodle} viewBox="0 0 220 110" aria-hidden="true" focusable="false">
            <path d="M13 78c31-5 49 8 74-1 23-8 35-29 57-28 18 1 31 16 63 3" />
            <path d="M158 26l26 22-17 5-9 16-9-43 9 0Z" />
            <path d="M184 48l16 14M177 53l17 15" />
          </svg>
        </div>
      </section>

      <section className={`shell ${styles.banks}`} id="question-banks" aria-labelledby="question-banks-heading">
        <header className={styles.sectionHeader}>
          <h2 id="question-banks-heading">Question banks</h2>
          <p>Choose your qualification, then your subject.</p>
        </header>

        <div className={styles.qualificationGrid}>
          {qualifications.map((qualification) => {
            const QualificationIcon = qualification.icon;
            return (
              <section className={styles.qualificationCard} key={qualification.name}>
                <header className={styles.qualificationHeader}>
                  <span className={styles.qualificationIcon} data-qualification-icon={qualification.iconName} aria-hidden="true">
                    <QualificationIcon weight="duotone" />
                  </span>
                  <div>
                    <h3>{qualification.name}</h3>
                    <span>{qualification.subjects.reduce((count, subject) => count + subject.banks.length, 0)} banks</span>
                  </div>
                </header>

                <div className={styles.subjectList}>
                  {qualification.subjects.map((subject) => (
                    <section className={`${styles.subjectRow} course-tone-${subject.tone}`} key={subject.name}>
                      <div className={styles.subjectHeading}>
                        <CourseIcon tone={subject.tone} />
                        <strong>{subject.name}</strong>
                      </div>
                      <div className={styles.bankLinks}>
                        {subject.banks.map((bank) => (
                          <Link href={`/banks/${bank.slug}?free=1`} key={bank.slug} aria-label={`${bank.shortName}, ${bank.questionCount.toLocaleString()} questions`}>
                            <span>
                              <strong>{bankVariant(bank)}</strong>
                              <small>{bank.questionCount.toLocaleString()} questions</small>
                            </span>
                            <ArrowRight aria-hidden="true" weight="bold" />
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className={styles.method} aria-labelledby="study-method-heading">
        <div className="shell">
          <header className={styles.sectionHeader}>
            <h2 id="study-method-heading">Simple on purpose.</h2>
            <p>Less hunting through PDFs. More actual practice.</p>
          </header>
          <ol className={styles.methodSteps}>
            <li><FunnelSimple aria-hidden="true" /><div><strong>Filter</strong><span>Pick a topic, year, paper, or question type.</span></div></li>
            <li><PencilSimpleLine aria-hidden="true" /><div><strong>Practise</strong><span>Work from the original exam question.</span></div></li>
            <li><DownloadSimple aria-hidden="true" /><div><strong>Export</strong><span>Save a set or download a clean PDF.</span></div></li>
          </ol>
        </div>
      </section>

      <section className={`shell ${styles.cta}`}>
        <div><h2>Ready to practise?</h2><p>Start free, then unlock more when you need it.</p></div>
        <div className={styles.ctaActions}>
          <Link className="button primary" href="/dashboard">Start practising <ArrowRight weight="bold" /></Link>
          <Link className="button secondary" href="/pricing">View pricing <ArrowRight weight="bold" /></Link>
        </div>
      </section>
    </div>
  );
}
