import { JsonLd } from "@/components/JsonLd";
import type { QuickFact } from "@/lib/quick-facts";

/** Data-backed answers below the practice area: question headings, one self-contained answer each. */
export function QuickFacts({ id, title, facts }: { id: string; title: string; facts: readonly QuickFact[] }) {
  if (facts.length === 0) return null;
  return (
    <section className="quick-facts" aria-labelledby={id}>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: facts.map((fact) => ({ "@type": "Question", name: fact.question, acceptedAnswer: { "@type": "Answer", text: fact.answer } })),
      }} />
      <h2 id={id}>{title}</h2>
      <div className="quick-facts-grid">
        {facts.map((fact) => <article key={fact.question}><h3>{fact.question}</h3><p>{fact.answer}</p></article>)}
      </div>
    </section>
  );
}
