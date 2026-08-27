import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, CheckCircle, DownloadSimple, FunnelSimple, Lightning, Target } from "@phosphor-icons/react/dist/ssr";
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
          <p className="kicker"><Lightning weight="fill" /> Built for exam-season focus</p>
          <h1>Find questions.<span>Start practising.</span></h1>
          <p className="hero-lede">Filter {totalQuestions.toLocaleString()} real IGCSE and IB Mathematics questions by topic, paper, year, and marks. Start free.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/dashboard">Start practising <ArrowRight weight="bold" /></Link>
            <Link className="button secondary" href="/pricing">See pricing</Link>
          </div>

        </div>
        <div className="hero-product-shot">
          <picture>
            <source media="(max-width: 640px)" srcSet="/pastpaperprep-workspace-focus.webp" />
            <Image src="/pastpaperprep-workspace.webp" alt="PastPaperPrep question bank showing topic filters and a searchable exam-question transcript" width={1280} height={650} fetchPriority="high" loading="eager" />
          </picture>
        </div>
      </section>

      <section className="proof-strip">
        <div><strong>{totalQuestions.toLocaleString()}</strong><span>curated questions</span></div>
        <div><strong>{totalPapers.toLocaleString()}</strong><span>exam papers indexed</span></div>
        <div><CheckCircle weight="fill" /><span>free questions in every bank</span></div>
      </section>

      <section className="value-section shell" aria-labelledby="value-heading">
        <div className="value-intro"><h2 id="value-heading">Revision should feel like doing maths.</h2><p>Not renaming PDFs, hunting mark schemes, or scrolling through questions you do not need.</p></div>
        <div className="value-sequence">
          <article><FunnelSimple /><div><h3>Target the gap</h3><p>Search and filter by the exact topic, year, paper, marks, and calculator rules you need.</p></div></article>
          <article><Target /><div><h3>Attempt the original</h3><p>Work from the real exam question with its marks and source context intact.</p></div></article>
          <article><CheckCircle /><div><h3>Check the method</h3><p>Open the answer or official mark scheme where available, then keep moving.</p></div></article>
          <article><DownloadSimple /><div><h3>Build a worksheet</h3><p>Select questions or export the filtered set into a clean, printable PDF.</p></div></article>
        </div>
      </section>

      <section className="banks-section shell" id="question-banks">
        <div className="section-heading">
          <div><h2>Six banks. One study system.</h2><p>Choose the syllabus you are sitting and get straight to the questions.</p></div>
        </div>
        <div className="bank-groups">
          {bankGroups.map((group) => (
            <section className={`bank-family bank-family-${group.banks[0].qualification === "Cambridge IGCSE" ? "cambridge" : "ib"}`} key={group.name} aria-labelledby={`bank-family-${group.name.replaceAll(" ", "-").toLowerCase()}`}>
              <header><div><h3 id={`bank-family-${group.name.replaceAll(" ", "-").toLowerCase()}`}>{group.name}</h3><p>{group.description}</p></div><span>{group.banks.length} {group.banks.length === 1 ? "bank" : "banks"}</span></header>
              <div className="bank-grid">
                {group.banks.map((bank) => (
                  <Link key={bank.slug} href={`/banks/${bank.slug}`} className={`bank-card ${bank.accent}`}>
                    <div className="bank-card-top"><span>{bank.subject}</span><ArrowUpRight aria-hidden="true" /></div>
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

      <section className="conversion-band shell">
        <div><h2>Need the complete question set?</h2><p>Choose one bank, a subject pair, or all six.</p></div>
        <div className="conversion-band-actions"><Link className="button primary" href="/pricing">Choose a plan <ArrowRight weight="bold" /></Link></div>
      </section>
    </>
  );
}
