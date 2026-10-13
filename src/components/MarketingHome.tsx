import Link from "next/link";
import { Fragment } from "react";
import Image from "next/image";
import { ArrowRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { Bank } from "@/lib/banks";
import { getCatalogRuntimeBanks } from "@/lib/catalog";
import { CourseIcon, type CourseTone } from "@/components/CourseIcon";
import { SmartSearch } from "@/components/SmartSearch";
import { QualificationTabs } from "@/components/QualificationTabs";
import { bankEntryHref, hasFreeTier } from "@/lib/access";
import { bankYearFacts } from "@/lib/upgrade-copy";
import { formatPrice, priceForBankCount } from "@/lib/pricing-model";
import { FAQS } from "@/components/FaqContent";
import { TestimonialGrid } from "@/components/Testimonial";
import { HOME_TESTIMONIALS } from "@/lib/testimonials";
import styles from "./MarketingHome.module.css";

type SubjectGroup = { name: string; tone: CourseTone; banks: Bank[] };
const SUBJECTS: readonly { name: string; tone: CourseTone; matches: (bank: Bank) => boolean }[] = [
  { name: "Mathematics", tone: "math", matches: (bank) => bank.subject.includes("Mathematics") || bank.subject.includes("Additional") },
  { name: "Chemistry", tone: "chemistry", matches: (bank) => bank.subject.includes("Chemistry") },
  { name: "Physics", tone: "physics", matches: (bank) => bank.subject.includes("Physics") },
  { name: "Biology", tone: "biology", matches: (bank) => bank.subject.includes("Biology") },
  { name: "Economics", tone: "economics", matches: (bank) => bank.subject.includes("Economics") },
  { name: "Co-ordinated Sciences", tone: "coordinated", matches: (bank) => bank.subject.includes("Co-ordinated") },
];
const PRACTICE_MODES = [{ id: "topics", label: "By topic" }, { id: "papers", label: "Full papers" }];
const HOME_FAQS = [FAQS[1], FAQS[2], FAQS[3], FAQS[5]];
const SAMPLE_BANK = "igcse";
const STUDIES = [
  { figure: "+25%", outcome: "exam scores from regular quizzing", source: "J. Educ. Psychology, 2011", href: "https://doi.org/10.1037/a0021782" },
  { figure: "+37%", outcome: "a week later vs. re-studying", source: "Science, 2011", href: "https://doi.org/10.1126/science.1199327" },
  { figure: "+53%", outcome: "remembered vs. rereading", source: "Psychological Science, 2006", href: "https://doi.org/10.1111/j.1467-9280.2006.01693.x" },
] as const;
/** Round down to the thousand: "40,000+" reads better than "40,169" and never overstates. */
const roundedDown = (count: number) => `${(Math.floor(count / 1000) * 1000).toLocaleString()}+`;

function groupSubjects(banks: readonly Bank[]): SubjectGroup[] { return SUBJECTS.map((s) => ({ name: s.name, tone: s.tone, banks: banks.filter(s.matches) })).filter((s) => s.banks.length > 0); }

/** Full-paper library facts per bank, from the build-time archive; absent while the library is off. */
export type HomePaperLinks = Readonly<Record<string, { href: string; count: number }>>;

function SubjectCards({ banks, papers }: { banks: readonly Bank[]; papers: HomePaperLinks }) {
  return <div className={styles.subjectGrid}>{groupSubjects(banks).map((group) => <section className={`${styles.subjectCard} course-tone-${group.tone}`} data-subject-tone={group.tone} key={group.name}>
    <header className={styles.subjectHead}><h3>{group.name}</h3><span className={styles.subjectMark}><CourseIcon tone={group.tone} /></span></header>
    <div className={styles.bankRows}>{group.banks.map((bank) => { const library = papers[bank.slug]; return <Fragment key={bank.slug}>
      <Link className={styles.bankRow} href={bankEntryHref(bank.slug)} data-bank-slug={bank.slug} data-mode-item={library ? "topics" : undefined} data-has-free-tier={hasFreeTier(bank.slug) ? "true" : undefined}>
        <strong>{bank.shortName}</strong><span>{bank.questionCount.toLocaleString()} questions</span><ArrowRight aria-hidden="true" weight="bold" />
      </Link>
      {library && <Link className={styles.bankRow} href={library.href} data-papers-slug={bank.slug} data-mode-item="papers">
        <strong>{bank.shortName}</strong><span>{library.count.toLocaleString()} papers</span><ArrowRight aria-hidden="true" weight="bold" />
      </Link>}
    </Fragment>; })}</div>
  </section>)}</div>;
}

export function MarketingHome({ environment = process.env, papers = {} }: { environment?: Record<string, string | undefined>; papers?: HomePaperLinks }) {
  const banks = getCatalogRuntimeBanks(environment);
  const cambridgeBanks = banks.filter((bank) => bank.qualification === "Cambridge IGCSE");
  const ibBanks = banks.filter((bank) => bank.qualification === "International Baccalaureate");
  const totalQuestions = banks.reduce((total, bank) => total + bank.questionCount, 0);
  const years = bankYearFacts(SAMPLE_BANK);

  return <div className={`${styles.home} landing-editorial`}>
    <section className={styles.hero} data-home-section="hero">
      <div className={styles.stage}>
        <Image className={styles.back} src="/artwork/landing-gothic.webp" alt="" fill preload sizes="100vw" quality={85} />
        <h1 className={styles.headline}><span>Past papers,</span> <em>by topic.</em></h1>
        <Image className={styles.front} src="/artwork/landing-gothic-front.webp" alt="" fill loading="eager" sizes="100vw" quality={85} />
        <div className={styles.fade} aria-hidden="true" />
      </div>
      <div className={styles.lede}>
        <SmartSearch />
        <p className={styles.heroLinks}><a href="#question-banks">All {banks.length} banks</a><span aria-hidden="true">·</span><Link href="/pricing">Plans</Link></p>
        <p className={styles.proof}><span><b>{roundedDown(totalQuestions)}</b> questions</span>{years && <span>Papers to <b>{years.latestYear}</b></span>}<span>Sorted by topic</span></p>
      </div>
    </section>

    <section className={`shell ${styles.banks}`} id="question-banks" data-home-section="banks" aria-labelledby="question-banks-heading">
      <h2 className="sr-only" id="question-banks-heading">Question banks</h2>
      <QualificationTabs modes={Object.keys(papers).length ? PRACTICE_MODES : undefined} items={[...(cambridgeBanks.length > 0 ? [{ id: "cambridge-catalog", label: "Cambridge IGCSE", panel: <SubjectCards banks={cambridgeBanks} papers={papers} /> }] : []), ...(ibBanks.length > 0 ? [{ id: "ib-catalog", label: "IB Diploma", panel: <SubjectCards banks={ibBanks} papers={papers} /> }] : [])]} />
    </section>

    <section className={styles.proofBand} data-home-section="proof" aria-labelledby="proof-heading">
      <div className="shell">
        <h2 className="sr-only" id="proof-heading">Why practise with past papers</h2>
        <dl className={styles.stats}>
          <div><dt>Real exam questions</dt><dd>{roundedDown(totalQuestions)}</dd></div>
          {years && <div><dt>Latest papers included</dt><dd>{years.latestYear}</dd></div>}
          <div><dt>Every question</dt><dd>By topic</dd></div>
          <div><dt>IGCSE &amp; IB subjects</dt><dd>{banks.length}</dd></div>
        </dl>
        <p className={styles.eyebrow}>Why practice works</p>
        <div className={styles.studies}>
          {STUDIES.map((study) => <article className={styles.study} data-research-study key={study.href}>
            <strong>{study.figure}</strong>
            <p>{study.outcome}</p>
            <a href={study.href} target="_blank" rel="noreferrer">{study.source} · Read study <ArrowRight weight="bold" /></a>
          </article>)}
        </div>
      </div>
    </section>

    <section className={`shell ${styles.voices}`} data-home-section="testimonials" aria-labelledby="testimonials-heading">
      <h2 className={styles.eyebrow} id="testimonials-heading">From students</h2>
      <TestimonialGrid testimonials={HOME_TESTIMONIALS} label="What students say" />
    </section>

    <section className={`shell ${styles.planSection}`} data-home-section="plan" aria-labelledby="plan-heading">
      <h2 id="plan-heading">Start free. <em>Upgrade for the newest papers.</em></h2>
      <div className={styles.tiers}>
        <div className={styles.tier} data-plan-tier="free">
          <p className={styles.tierName}>Free</p>
          <p className={styles.tierPrice}>$0</p>
          <ul><li>Older exam years on every bank</li><li>Answers included</li><li>No card needed</li></ul>
          <Link className="button secondary" href={bankEntryHref(SAMPLE_BANK)}>Start free</Link>
        </div>
        <div className={`${styles.tier} ${styles.tierPlan}`} data-plan-tier="plan">
          <p className={styles.tierName}>Plan</p>
          <p className={styles.tierPrice}><small>from </small>{formatPrice(priceForBankCount("monthly", 1))}<small>/mo</small></p>
          <ul><li>{years ? `Every year up to ${years.latestYear}` : "Every exam year"}</li><li>Every official mark scheme</li><li>Cancel any time</li></ul>
          <Link className="button primary" href="/pricing">See plans <ArrowRight weight="bold" /></Link>
        </div>
      </div>
    </section>

    <section className={`shell ${styles.faqPreview}`} data-home-section="faq" aria-labelledby="home-faq-heading">
      <header className={styles.faqIntro}>
        <p className={styles.eyebrow}>Good to know</p>
        <h2 id="home-faq-heading">Questions before you start?</h2>
        <Link className={styles.faqAllLink} href="/faq">View all FAQs <ArrowRight weight="bold" /></Link>
      </header>
      <div className={styles.faqQuestions}>
        {HOME_FAQS.map((faq) => <details data-home-faq key={faq.question}>
          <summary>{faq.question}<CaretDown aria-hidden="true" weight="bold" /></summary>
          <p>{faq.answer}</p>
        </details>)}
        <p className={styles.faqContact}>Still need help? <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a></p>
      </div>
    </section>

    <section className={`shell ${styles.cta}`} data-home-section="cta" aria-labelledby="cta-heading">
      <h2 id="cta-heading">Start with one topic.</h2>
      <Link className="button primary" href="#question-banks">Choose your course <ArrowRight weight="bold" /></Link>
    </section>
  </div>;
}
