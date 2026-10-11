import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { Bank } from "@/lib/banks";
import { getCatalogRuntimeBanks } from "@/lib/catalog";
import { CourseIcon, type CourseTone } from "@/components/CourseIcon";
import { HeroPicker, type PickerGroup } from "@/components/HeroPicker";
import { QualificationTabs } from "@/components/QualificationTabs";
import { bankEntryHref, hasFreeTier } from "@/lib/access";
import { bankYearFacts } from "@/lib/upgrade-copy";
import { PRICING_MODEL, formatPrice, priceForBankCount } from "@/lib/pricing-model";
import { FAQS } from "@/components/FaqContent";
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
const HOME_FAQS = [FAQS[1], FAQS[2], FAQS[3], FAQS[5]];
const SAMPLE_BANK = "igcse";

function groupSubjects(banks: readonly Bank[]): SubjectGroup[] { return SUBJECTS.map((s) => ({ name: s.name, tone: s.tone, banks: banks.filter(s.matches) })).filter((s) => s.banks.length > 0); }

function SubjectCards({ banks }: { banks: readonly Bank[] }) {
  return <div className={styles.subjectGrid}>{groupSubjects(banks).map((group) => <section className={`${styles.subjectCard} course-tone-${group.tone}`} data-subject-tone={group.tone} key={group.name}>
    <header className={styles.subjectHead}><h3>{group.name}</h3><span className={styles.subjectMark}><CourseIcon tone={group.tone} /></span></header>
    <div className={styles.bankRows}>{group.banks.map((bank) => <Link className={styles.bankRow} href={bankEntryHref(bank.slug)} data-bank-slug={bank.slug} data-has-free-tier={hasFreeTier(bank.slug) ? "true" : undefined} key={bank.slug}>
      <strong>{bank.shortName}</strong><span>{bank.questionCount.toLocaleString()} questions</span><ArrowRight aria-hidden="true" weight="bold" />
    </Link>)}</div>
  </section>)}</div>;
}

const toPickerBanks = (banks: readonly Bank[]) => banks.map((bank) => ({ slug: bank.slug, label: bank.shortName, href: bankEntryHref(bank.slug) }));

export function MarketingHome({ environment = process.env }: { environment?: Record<string, string | undefined> }) {
  const banks = getCatalogRuntimeBanks(environment);
  const cambridgeBanks = banks.filter((bank) => bank.qualification === "Cambridge IGCSE");
  const ibBanks = banks.filter((bank) => bank.qualification === "International Baccalaureate");
  const totalQuestions = banks.reduce((total, bank) => total + bank.questionCount, 0);
  const totalPapers = banks.reduce((total, bank) => total + bank.paperCount, 0);
  const pickerGroups: PickerGroup[] = [
    { id: "igcse", label: "IGCSE", banks: toPickerBanks(cambridgeBanks) },
    { id: "ib", label: "IB", banks: toPickerBanks(ibBanks) },
  ];
  const years = bankYearFacts(SAMPLE_BANK);
  const plans = [
    { label: "One bank", price: formatPrice(priceForBankCount("monthly", 1)) },
    { label: `${PRICING_MODEL.builder.minBanks}–${PRICING_MODEL.builder.maxBanks} banks`, price: formatPrice(priceForBankCount("monthly", PRICING_MODEL.builder.minBanks)), from: true },
    { label: "All banks", price: formatPrice(PRICING_MODEL.allAccess.monthlyCents) },
  ];

  return <div className={`${styles.home} landing-editorial`}>
    <section className={styles.hero}>
      <div className={styles.stage}>
        <Image className={styles.back} src="/artwork/landing-gothic.webp" alt="" fill priority sizes="100vw" quality={85} />
        <h1 className={styles.headline}><span>Past papers,</span> <em>by topic.</em></h1>
        <Image className={styles.front} src="/artwork/landing-gothic-front.webp" alt="" fill sizes="100vw" quality={85} />
        <div className={styles.fade} aria-hidden="true" />
      </div>
      <div className={styles.lede}>
        <HeroPicker groups={pickerGroups} />
        <p className={styles.heroLinks}><a href="#question-banks">All {banks.length} banks</a><span aria-hidden="true">·</span><Link href="/pricing">Plans</Link></p>
        <p className={styles.proof}><span><b>{totalQuestions.toLocaleString()}</b> questions</span><span><b>{totalPapers.toLocaleString()}</b> papers</span><span><b>{banks.length}</b> banks</span></p>
      </div>
    </section>

    <section className={`shell ${styles.sample}`} aria-labelledby="sample-heading">
      <div className={styles.sampleCopy}>
        <p className={styles.eyebrow}>Try one now</p>
        <h2 id="sample-heading">A real question. <em>The real mark scheme.</em></h2>
        <Link className="button primary" href={bankEntryHref(SAMPLE_BANK)}>Try free questions <ArrowRight weight="bold" /></Link>
      </div>
      <figure className={styles.sampleFigure}>
        <div className={styles.sampleQuestion}>
          <p>0580 · 2018 May/June · Paper 23 · Q22 · Sequences</p>
          <Image src="/landing/sample-question.webp" alt="Question 22: find an expression for the nth term of each sequence. (a) 11, 7, 3, −1, … (b) 3, 6, 12, 24, …" width={900} height={593} sizes="(max-width: 900px) 92vw, 560px" />
        </div>
        <div className={styles.sampleAnswer}>
          <p>Mark scheme</p>
          <Image src="/landing/sample-markscheme.webp" alt="Mark scheme: (a) 15 − 4n, 2 marks. (b) 3 × 2 to the power n − 1, 2 marks." width={900} height={97} sizes="(max-width: 900px) 86vw, 470px" />
        </div>
      </figure>
    </section>

    <section className={`shell ${styles.banks}`} id="question-banks" aria-label="Question banks">
      <QualificationTabs items={[...(cambridgeBanks.length > 0 ? [{ id: "cambridge-catalog", label: "Cambridge IGCSE", panel: <SubjectCards banks={cambridgeBanks} /> }] : []), ...(ibBanks.length > 0 ? [{ id: "ib-catalog", label: "IB Diploma", panel: <SubjectCards banks={ibBanks} /> }] : [])]} />
    </section>

    <section className={styles.planBand} aria-labelledby="plan-heading">
      <div className={`shell ${styles.planGrid}`}>
        <div>
          <p className={styles.eyebrow}>Free vs plan</p>
          <h2 id="plan-heading">The newest papers <em>are the ones that count.</em></h2>
          <p className={styles.planNote}>Older years are free on every bank. A plan opens the latest papers and every mark scheme.</p>
          {years && <div className={styles.years} aria-label={`Mathematics 0580: ${years.freeLabel} free, ${years.paidLabel} on a plan`}>
            {years.coverage.map((year) => <span key={year} data-year-paid={!years.freeYears.includes(year) || undefined}>{year}</span>)}
          </div>}
        </div>
        <div className={styles.planOffer}>
          <div className={styles.planCards}>{plans.map((plan) => <p data-plan key={plan.label}><span>{plan.label}</span><strong>{plan.from && <small>from </small>}{plan.price}<small>/mo</small></strong></p>)}</div>
          <Link className="button primary" href="/pricing">See plans <ArrowRight weight="bold" /></Link>
        </div>
      </div>
    </section>

    <section className={`shell ${styles.faqPreview}`} aria-labelledby="home-faq-heading">
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

    <section className={`shell ${styles.cta}`} aria-labelledby="cta-heading">
      <h2 id="cta-heading">Start with one topic.</h2>
      <Link className="button primary" href="#question-banks">Choose your course <ArrowRight weight="bold" /></Link>
    </section>
  </div>;
}
