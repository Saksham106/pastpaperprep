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

export function BankSeoContent({ bank }: { bank: Bank }) {
  const guide = guideFor(bank);
  const isScience = bank.slug === "ib-chemistry-hl" || bank.slug === "ib-chemistry-sl" || bank.slug === "ib-physics-hl" || bank.slug === "ib-physics-sl" || bank.slug === "ib-biology-hl" || bank.slug === "ib-biology-sl";
  const coverage = `This bank contains ${bank.questionCount.toLocaleString()} questions drawn from ${bank.paperCount} real past papers, covering ${bank.years}. Use it to isolate weak topics before switching to timed whole-paper practice.`;
  const isIbMathAaHl = bank.slug === "ib-hl";

  return (
    <section className="bank-seo-content" aria-labelledby="bank-guide-heading">
      <div>
        <p className="eyebrow">{isIbMathAaHl ? "IB Mathematics AA HL · focused practice" : "Revision method"}</p>
        <h2 id="bank-guide-heading">{isIbMathAaHl ? "Build a printable IB Maths AA HL practice set" : `How to use the ${bank.shortName} question bank`}</h2>
        <p>{isIbMathAaHl ? <>Use this existing question bank for <Link href={guide.href}>IB Maths AA HL past papers by topic</Link>: choose a topic, select matching questions, then build a worksheet and download its PDF when your account and plan allow. The bank remains the canonical place to practise; this guide explains the workflow.</> : coverage}</p>
      </div>
      {isIbMathAaHl ? (
        <ol>
          <li><strong>Choose a topic.</strong> Filter the IB Maths AA HL bank by the topic you want to practise.</li>
          <li><strong>Select questions, then build a worksheet.</strong> Choose questions from the results and use the worksheet controls to assemble your set.</li>
          <li><strong>Download PDF when eligible.</strong> PDF export is available only with an eligible paid plan and subject to its export quota. Free questions require an account; the free allowance is limited per filtered result set. Paid questions remain locked unless your plan includes this bank.</li>
        </ol>
      ) : (
        <ol>
          <li><strong>Choose one topic.</strong> Start narrow enough that mistakes reveal a specific gap.</li>
          <li><strong>Filter deliberately.</strong> Use year, paper, marks, and other filters to control difficulty and format.</li>
          <li><strong>Check, record, repeat.</strong> Review the mark scheme, note the cause of each lost mark, then retry a similar set.</li>
        </ol>
      )}
      <div className="bank-seo-links">
        <Link href={guide.href}>{guide.label}</Link>
        {!isScience ? (
          <Link href="/articles/how-to-use-maths-past-papers-effectively">How to use past papers effectively</Link>
        ) : null}
      </div>
    </section>
  );
}
