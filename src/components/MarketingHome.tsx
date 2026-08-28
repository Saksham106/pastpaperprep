import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, DownloadSimple, FunnelSimple, PencilSimpleLine } from "@phosphor-icons/react/dist/ssr";
import { BANKS } from "@/lib/banks";

const COURSE_GROUPS = [
  {
    name: "Cambridge IGCSE",
    detail: "0580 and 0606",
    banks: BANKS.filter((bank) => bank.qualification === "Cambridge IGCSE"),
  },
  {
    name: "IB Analysis and Approaches",
    detail: "Higher and Standard Level",
    banks: BANKS.filter((bank) => bank.subject.includes("AA")),
  },
  {
    name: "IB Applications and Interpretation",
    detail: "Higher and Standard Level",
    banks: BANKS.filter((bank) => bank.subject.includes("AI")),
  },
] as const;

export function MarketingHome() {
  const totalQuestions = BANKS.reduce((total, bank) => total + bank.questionCount, 0);
  const totalPapers = BANKS.reduce((total, bank) => total + bank.paperCount, 0);

  return (
    <>
      <section className="exam-hero shell">
        <div className="exam-hero-copy">
          <p className="hero-context">IGCSE + IB Mathematics</p>
          <h1>Practise the questions that move your grade.</h1>
          <p className="exam-hero-lede">Filter exact past-paper questions, practise free, and build printable sets. No account needed.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/dashboard">Start practising <ArrowRight weight="bold" /></Link>
          </div>
        </div>

        <aside className="exam-index-visual" aria-label="PastPaperPrep question bank coverage">
          <header><span>Question bank</span><strong>IGCSE + IB</strong></header>
          <div className="exam-index-mark" aria-hidden="true">x²</div>
          <div className="exam-index-codes" aria-label="Available mathematics courses">
            <span><strong>0580</strong><small>Mathematics</small></span>
            <span><strong>0606</strong><small>Additional</small></span>
            <span><strong>AA</strong><small>Analysis</small></span>
            <span><strong>AI</strong><small>Applications</small></span>
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
          {COURSE_GROUPS.map((group) => (
            <section className="curriculum-row" key={group.name} aria-labelledby={`course-${group.name.replaceAll(" ", "-").toLowerCase()}`}>
              <div className="curriculum-heading">
                <h3 id={`course-${group.name.replaceAll(" ", "-").toLowerCase()}`}>{group.name}</h3>
                <span>{group.detail}</span>
              </div>
              <div className="curriculum-bank-links">
                {group.banks.map((bank) => (
                  <Link href={`/banks/${bank.slug}?free=1`} key={bank.slug}>
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
        <div><strong>6</strong><span>focused question banks</span></div>
        <p><Check weight="bold" /> Answers, worked solutions, and official markschemes where available</p>
      </section>

      <section className="study-method shell" aria-labelledby="study-method-heading">
        <div className="study-method-copy">
          <h2 id="study-method-heading">Spend your revision time doing maths.</h2>
          <p>PastPaperPrep removes the file hunting and keeps every step of practice in one focused workspace.</p>
          <ol>
            <li><FunnelSimple aria-hidden="true" /><div><strong>Target the gap</strong><span>Filter by topic, year, paper, marks, and calculator rules.</span></div></li>
            <li><PencilSimpleLine aria-hidden="true" /><div><strong>Attempt the original</strong><span>Work from the real exam question with its source context intact.</span></div></li>
            <li><DownloadSimple aria-hidden="true" /><div><strong>Build the next set</strong><span>Select useful questions and export a clean printable PDF.</span></div></li>
          </ol>
        </div>
      </section>

      <section className="pricing-invite shell">
        <div>
          <h2>Start free. Unlock more when you need it.</h2>
          <p>Choose one bank, a subject pair, or the complete six-bank library.</p>
        </div>
        <Link className="button primary" href="/pricing">Compare plans <ArrowRight weight="bold" /></Link>
      </section>
    </>
  );
}
