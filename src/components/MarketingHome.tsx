import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, DownloadSimple, FunnelSimple, PencilSimpleLine } from "@phosphor-icons/react/dist/ssr";
import { CourseIcon, courseToneForBank, type CourseTone } from "@/components/CourseIcon";
import { getAvailableBanks, type Bank } from "@/lib/banks";

const IGCSE_CODE_BY_SLUG: Record<string, string> = {
  igcse: "0580",
  "igcse-additional": "0606",
  "igcse-biology-0610": "0610",
  "igcse-economics-0455": "0455",
};

function getCourseGroups(banks: readonly Bank[]) {
  return [
    {
      name: "Cambridge IGCSE",
      detail: banks
        .filter((bank) => bank.qualification === "Cambridge IGCSE")
        .map((bank) => IGCSE_CODE_BY_SLUG[bank.slug] ?? bank.shortName)
        .join(", "),
      tone: "math" as CourseTone,
      banks: banks.filter((bank) => bank.qualification === "Cambridge IGCSE"),
    },
    {
      name: "IB Mathematics · Analysis and Approaches",
      detail: "Higher and Standard Level",
      tone: "math" as CourseTone,
      banks: banks.filter((bank) => bank.subject.includes("AA")),
    },
    {
      name: "IB Mathematics · Applications and Interpretation",
      detail: "Higher and Standard Level",
      tone: "math" as CourseTone,
      banks: banks.filter((bank) => bank.subject.includes("AI")),
    },
    {
      name: "IB Chemistry",
      detail: "Higher and Standard Level",
      tone: "chemistry" as CourseTone,
      banks: banks.filter((bank) => bank.subject.includes("Chemistry")),
    },
    {
      name: "IB Physics",
      detail: "Higher and Standard Level",
      tone: "physics" as CourseTone,
      banks: banks.filter((bank) => bank.subject.includes("Physics")),
    },
    {
      name: "IB Biology",
      detail: "Higher and Standard Level",
      tone: "biology" as CourseTone,
      banks: banks.filter((bank) => bank.subject.includes("Biology") && bank.qualification === "International Baccalaureate"),
    },
    {
      name: "IB Economics",
      detail: "Higher and Standard Level",
      tone: "math" as CourseTone,
      banks: banks.filter((bank) => bank.subject.includes("Economics") && bank.qualification === "International Baccalaureate"),
    },
  ].filter((group) => group.banks.length > 0);
}

export function MarketingHome({ environment = process.env }: { environment?: Record<string, string | undefined> }) {
  const banks = getAvailableBanks(environment);
  const courseGroups = getCourseGroups(banks);
  const totalQuestions = banks.reduce((total, bank) => total + bank.questionCount, 0);
  const totalPapers = banks.reduce((total, bank) => total + bank.paperCount, 0);
  const includesEconomics = banks.some((bank) => bank.subject.includes("Economics"));

  return (
    <>
      <section className="exam-hero shell">
        <div className="exam-hero-copy">
          <p className="hero-context">IGCSE + IB Maths + Chemistry + Physics + Biology{includesEconomics ? " + Economics" : ""}</p>
          <h1>Practise the questions that move your grade.</h1>
          <p className="exam-hero-lede">Filter exact past-paper questions, practise free, and build printable sets. No account needed.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/dashboard">Start practising <ArrowRight weight="bold" /></Link>
          </div>
        </div>

        <aside className="exam-index-visual" aria-label="PastPaperPrep question bank coverage">
          <header><span>Question bank</span><strong>IGCSE + IB</strong></header>
          <div className="exam-index-formula" aria-hidden="true">
            <span>x<sup>2</sup></span><i>·</i><span>H<sub>2</sub>O</span>
          </div>
          <div className="exam-index-codes" aria-label="Available courses">
            <span><strong>0580</strong><small>Mathematics</small></span>
            <span><strong>0606</strong><small>Additional</small></span>
            <span><strong>AA</strong><small>Analysis</small></span>
            <span><strong>AI</strong><small>Applications</small></span>
            <span><strong>CHEM</strong><small>Chemistry</small></span>
            <span><strong>PHYS</strong><small>Physics</small></span>
            <span><strong>BIO</strong><small>Biology</small></span>
          </div>
          <footer><span>{totalQuestions.toLocaleString()} questions</span><span>{totalPapers.toLocaleString()} papers</span></footer>
        </aside>
      </section>

      <section className="course-launcher shell" id="question-banks" aria-labelledby="course-launcher-heading">
        <header>
          <h2 id="course-launcher-heading">Choose your course</h2>
          <p>Every course includes full exam years you can practise for free.</p>
        </header>
        <div className="curriculum-index">
          {courseGroups.map((group) => (
            <section className={`curriculum-row course-tone-${group.tone}`} key={group.name} aria-labelledby={`course-${group.name.replaceAll(" ", "-").toLowerCase()}`}>
              <div className="curriculum-heading">
                <CourseIcon tone={group.tone} />
                <div>
                  <h3 id={`course-${group.name.replaceAll(" ", "-").toLowerCase()}`}>{group.name}</h3>
                  <span>{group.detail}</span>
                </div>
              </div>
              <div className="curriculum-bank-links">
                {group.banks.map((bank) => (
                  <Link className={`course-tone-${courseToneForBank(bank)}`} href={`/banks/${bank.slug}?free=1`} key={bank.slug}>
                    <CourseIcon tone={courseToneForBank(bank)} />
                    <span><strong>{bank.shortName}</strong><small>{bank.questionCount.toLocaleString()} questions</small></span>
                    <ArrowUpRight aria-hidden="true" weight="bold" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="corpus-ledger shell" aria-label="Question bank coverage">
        <div><strong>{totalQuestions.toLocaleString()}</strong><span>curated questions</span></div>
        <div><strong>{totalPapers.toLocaleString()}</strong><span>exam papers indexed</span></div>
        <div><strong>{banks.length}</strong><span>focused question banks</span></div>
        <p><Check weight="bold" /> Answers, worked solutions, and official markschemes where available</p>
      </section>

      <section className="study-method shell" aria-labelledby="study-method-heading">
        <div className="study-method-copy">
          <h2 id="study-method-heading">Spend your revision time practising.</h2>
          <p>PastPaperPrep removes the file hunting and keeps every step of practice in one focused workspace.</p>
          <ol>
            <li><FunnelSimple aria-hidden="true" /><div><strong>Target the gap</strong><span>Filter by topic, year, paper, marks, and question format.</span></div></li>
            <li><PencilSimpleLine aria-hidden="true" /><div><strong>Attempt the original</strong><span>Work from the real exam question with its source context intact.</span></div></li>
            <li><DownloadSimple aria-hidden="true" /><div><strong>Build the next set</strong><span>Select useful questions and export a clean printable PDF.</span></div></li>
          </ol>
        </div>
      </section>

      <section className="pricing-invite shell">
        <div>
          <h2>Start free. Unlock more when you need it.</h2>
          <p>Choose one bank, a subject pair, or the complete {banks.length}-bank library.</p>
        </div>
        <Link className="button primary" href="/pricing">Compare plans <ArrowRight weight="bold" /></Link>
      </section>
    </>
  );
}
