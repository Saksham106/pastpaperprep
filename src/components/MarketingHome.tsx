import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle, FunnelSimple, Lightning, Target } from "@phosphor-icons/react/dist/ssr";
import { BANKS } from "@/lib/banks";

export function MarketingHome() {
  const totalQuestions = BANKS.reduce((total, bank) => total + bank.questionCount, 0);
  const totalPapers = BANKS.reduce((total, bank) => total + bank.paperCount, 0);
  const bankGroups = [
    { name: "Cambridge IGCSE", description: "Core and Additional Mathematics", banks: BANKS.filter((bank) => bank.qualification === "Cambridge IGCSE") },
    { name: "IB Mathematics", description: "Analysis and Approaches, Applications and Interpretation", banks: BANKS.filter((bank) => bank.qualification === "International Baccalaureate") },
  ];

  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <p className="kicker"><Lightning weight="fill" /> Topic practice without the scavenger hunt</p>
          <h1>Past papers,<br /><span>properly organised.</span></h1>
          <p className="hero-lede">Stop digging through PDFs. Find the exact questions you need by topic, year, and paper, then check the method while it is still fresh.</p>
          <div className="hero-actions">
            <Link className="button primary" href="#question-banks">Choose your course <ArrowRight weight="bold" /></Link>
            <span><CheckCircle weight="fill" /> {totalQuestions.toLocaleString()} real questions ready</span>
          </div>
        </div>
        <div className="hero-preview" aria-label="Product preview">
          <div className="preview-top"><span>Calculus</span><span>2026 • Paper 1</span></div>
          <p className="preview-label">QUESTION 1 · 6 MARKS</p>
          <h2>Differentiate a linear-plus-sine function and determine its tangent at x = π.</h2>
          <div className="formula">f(x) = 2x + sin x</div>
          <div className="preview-bottom"><span>IB Math AA SL</span><span className="answer-pill">Worked answer ready</span></div>
        </div>
      </section>

      <section className="proof-strip">
        <div><strong>{totalQuestions.toLocaleString()}</strong><span>curated questions</span></div>
        <div><strong>{totalPapers.toLocaleString()}</strong><span>exam papers indexed</span></div>
        <div><strong>{BANKS.length}</strong><span>focused question banks</span></div>
      </section>

      <section className="banks-section shell" id="question-banks">
        <div className="section-heading">
          <div><p className="eyebrow">Pick your course</p><h2>One place. Six serious question banks.</h2></div>
          <p>Start with the syllabus you are sitting now. Your progress and access can move with you as the platform expands.</p>
        </div>
        <div className="bank-groups">
          {bankGroups.map((group) => (
            <section className={`bank-family bank-family-${group.banks[0].qualification === "Cambridge IGCSE" ? "cambridge" : "ib"}`} key={group.name} aria-labelledby={`bank-family-${group.name.replaceAll(" ", "-").toLowerCase()}`}>
              <header><div><h3 id={`bank-family-${group.name.replaceAll(" ", "-").toLowerCase()}`}>{group.name}</h3><p>{group.description}</p></div><span>{group.banks.length} {group.banks.length === 1 ? "bank" : "banks"}</span></header>
              <div className="bank-grid">
                {group.banks.map((bank) => (
                  <Link key={bank.slug} href={`/banks/${bank.slug}`} className={`bank-card ${bank.accent}`}>
                    <div className="bank-card-top"><span>{bank.subject}</span><ArrowUpRight /></div>
                    <h4>{bank.shortName}</h4>
                    <p>{bank.description}</p>
                    <div className="bank-stats"><strong>{bank.questionCount.toLocaleString()}</strong><span>questions</span><strong>{bank.paperCount}</strong><span>papers</span></div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="method-section shell">
        <div className="method-copy"><p className="eyebrow">A tighter study loop</p><h2>Go from weak topic to exam-ready.</h2><p>PastPaperPrep removes the admin around revision, so your time goes into solving, checking, and repeating.</p></div>
        <ol className="method-list">
          <li><FunnelSimple /><div><span>01</span><strong>Filter precisely</strong><p>Choose topic, year, paper, or search the method you need.</p></div></li>
          <li><Target /><div><span>02</span><strong>Attempt the real question</strong><p>Practise with the original exam context and mark allocation.</p></div></li>
          <li><CheckCircle /><div><span>03</span><strong>Check and close the gap</strong><p>Use the worked solution or mark scheme, then try the next one.</p></div></li>
        </ol>
      </section>
    </>
  );
}
