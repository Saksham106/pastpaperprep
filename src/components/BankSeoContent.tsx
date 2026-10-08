import Link from "next/link";
import type { Bank } from "@/lib/banks";

function guideFor(bank: Bank) {
  if (bank.slug === "igcse") {
    return {
      href: "/articles/igcse-maths-0580-past-papers-by-topic",
      label: "IGCSE 0580 revision guide",
    };
  }

  if (bank.slug === "igcse-additional") {
    return {
      href: "/articles/how-to-use-maths-past-papers-effectively",
      label: "Past paper revision method",
    };
  }

  if (bank.slug === "ib-chemistry-hl" || bank.slug === "ib-chemistry-sl") {
    return {
      href: "/articles",
      label: "Revision guides",
    };
  }

  if (bank.slug === "ib-physics-hl" || bank.slug === "ib-physics-sl") {
    return {
      href: "/articles",
      label: "IB Physics revision guides",
    };
  }

  if (bank.slug === "ib-biology-hl" || bank.slug === "ib-biology-sl") {
    return {
      href: "/articles/ib-biology-past-papers-by-topic",
      label: "IB Biology revision guide",
    };
  }

  return {
    href: "/articles/ib-math-past-papers-by-topic",
    label: "IB Maths past papers by topic guide",
  };
}

function examStyleLinkFor(bank: Bank) {
  if (bank.slug === "ib-sl") return { href: "/banks/ib-sl/exam-style/probability-distributions", label: "IB Math AA SL probability-distribution practice" };
  if (bank.slug === "igcse") return { href: "/banks/igcse/exam-style", label: "IGCSE 0580 exam-style practice" };
  if (bank.slug === "igcse-additional") return { href: "/banks/igcse-additional/exam-style", label: "IGCSE 0606 differentiation practice" };
  return null;
}

export function BankSeoContent({ bank }: { bank: Bank }) {
  const guide = guideFor(bank);
  const examStyleLink = examStyleLinkFor(bank);
  const isScience = bank.slug === "ib-chemistry-hl" || bank.slug === "ib-chemistry-sl" || bank.slug === "ib-physics-hl" || bank.slug === "ib-physics-sl" || bank.slug === "ib-biology-hl" || bank.slug === "ib-biology-sl";
  const coverage = `Practise ${bank.questionCount.toLocaleString()} authentic past-paper questions from ${bank.paperCount} archived papers (${bank.years}). These are past-paper questions, not AI-generated exam-style substitutes. Start with a topic, then switch to mixed or timed practice.`;
  const isIbMathAaHl = bank.slug === "ib-hl";

  return (
    <section className="bank-seo-content" aria-labelledby="bank-guide-heading">
      <div>
        <p className="eyebrow">{isIbMathAaHl ? "IB Mathematics AA HL · focused practice" : "Revision method"}</p>
        <h2 id="bank-guide-heading">{isIbMathAaHl ? "Build a printable IB Maths AA HL practice set" : `How to use the ${bank.shortName} question bank`}</h2>
        <p>{isIbMathAaHl ? "PastPaperPrep lets you practise authentic AA HL past-paper questions and turn selected questions into a printable practice set. Choose a topic, select questions, then export a worksheet with available answers." : coverage}</p>
        {isIbMathAaHl ? <p>{coverage}</p> : null}
      </div>
      {isIbMathAaHl ? (
        <ol>
          <li><strong>Choose a topic.</strong> Filter the IB Maths AA HL bank by the topic you want to practise.</li>
          <li><strong>Select questions, then build a worksheet.</strong> Choose questions from the results and use the worksheet controls to assemble your set.</li>
          <li><strong>Export your practice set.</strong> PDF export requires eligible access to this bank and follows your plan’s download allowance. Guests can view up to 20 matching free questions; a free account unlocks the rest of the free selection. Recent paid questions and worksheet/PDF tools require eligible bank access.</li>
        </ol>
      ) : (
        <ol>
          <li><strong>Choose a topic.</strong> Focus your practice on a real past-paper topic rather than a generated exam-style substitute.</li>
          <li><strong>Work through the available questions and answers.</strong> Use the matching mark scheme to check your reasoning and identify a precise gap.</li>
          <li><strong>Export when eligible.</strong> Guests can view up to 20 matching free questions; a free account can access the remaining free selection. PDF export is subject to eligible bank access and the account’s download allowance.</li>
        </ol>
      )}
      <div className="bank-seo-links">
        <Link href={guide.href}>{guide.label}</Link>
        {examStyleLink ? <Link href={examStyleLink.href}>{examStyleLink.label}</Link> : null}
        {!isScience ? (
          <Link href="/articles/how-to-use-maths-past-papers-effectively">How to use past papers effectively</Link>
        ) : null}
      </div>
    </section>
  );
}
