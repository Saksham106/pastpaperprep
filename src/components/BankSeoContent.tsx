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

  return {
    href: "/articles/ib-math-past-papers-by-topic",
    label: "IB Maths past papers by topic guide",
  };
}

export function BankSeoContent({ bank }: { bank: Bank }) {
  const guide = guideFor(bank);
  const isScience = bank.slug === "ib-chemistry-hl" || bank.slug === "ib-chemistry-sl" || bank.slug === "ib-physics-hl" || bank.slug === "ib-physics-sl";
  const coverage = `This bank contains ${bank.questionCount.toLocaleString()} questions drawn from ${bank.paperCount} real past papers, covering ${bank.years}. Use it to isolate weak topics before switching to timed whole-paper practice.`;

  return (
    <section className="bank-seo-content" aria-labelledby="bank-guide-heading">
      <div>
        <p className="eyebrow">Revision method</p>
        <h2 id="bank-guide-heading">How to use the {bank.shortName} question bank</h2>
        <p>{coverage}</p>
      </div>
      <ol>
        <li><strong>Choose one topic.</strong> Start narrow enough that mistakes reveal a specific gap.</li>
        <li><strong>Filter deliberately.</strong> Use year, paper, marks, and other filters to control difficulty and format.</li>
        <li><strong>Check, record, repeat.</strong> Review the mark scheme, note the cause of each lost mark, then retry a similar set.</li>
      </ol>
      <div className="bank-seo-links">
        <Link href={guide.href}>{guide.label}</Link>
        {!isScience ? (
          <Link href="/articles/how-to-use-maths-past-papers-effectively">How to use past papers effectively</Link>
        ) : null}
      </div>
    </section>
  );
}
