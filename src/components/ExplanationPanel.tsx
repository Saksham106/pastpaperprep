// No "use client": pure markup, so past-paper pages render worked answers on the server with no client JS,
// while QuestionExplorer still loads it on demand in the browser.
import "katex/dist/katex.min.css";
import { ExplanationMath } from "@/components/ExplanationMath";
import type { Explanation } from "@/lib/explanation-format";
import { renderDisplayMath, renderInlineMath } from "@/lib/explanation-math";
import styles from "./ExplanationPanel.module.css";

export { renderInlineMath };

/** "a(ii)" -> "(a)(ii)"; bare "ii(a)" -> "(ii)(a)"; "" stays empty. */
export function formatPartLabel(label: string): string {
  const bare = /^([ivx]+)(?:\(([a-z])\))?$/.exec(label);
  if (bare) return `(${bare[1]})${bare[2] ? `(${bare[2]})` : ""}`;
  const match = /^([a-z])(\(([ivx]+)\)(?:([1-9])|\(([a-z])\))?)?$/.exec(label);
  if (!match) return label;
  return `(${match[1]})${match[3] ? `(${match[3]})` : ""}${match[4] ? ` ${match[4]}.` : ""}${match[5] ? `(${match[5]})` : ""}`;
}

type Props = {
  explanation: Explanation;
  revise?: { href: string; label: string };
  /**
   * For server rendering: KaTeX markup goes into the HTML only and the RSC payload carries the TeX (ExplanationMath).
   * Off in the browser-only QuestionExplorer, which already has KaTeX loaded with this module.
   */
  texPayload?: boolean;
};

function Inline({ text, texPayload }: { text: string; texPayload: boolean }) {
  return texPayload ? <ExplanationMath text={text} /> : <span dangerouslySetInnerHTML={{ __html: renderInlineMath(text) }} />;
}

export default function ExplanationPanel({ explanation, revise, texPayload = false }: Props) {
  const multiPart = explanation.parts.length > 1 || explanation.parts[0]?.label !== "";
  return (
    <div className={styles.parts}>
      {explanation.parts.map((part) => (
        <section key={part.label || "whole"} className={styles.part} aria-label={multiPart ? `Part ${formatPartLabel(part.label)}` : "Worked solution"}>
          {multiPart && <header className={styles.partHeader}><strong>{formatPartLabel(part.label)}</strong><span>{part.marks} {part.marks === 1 ? "mark" : "marks"}{part.withdrawn && " · withdrawn, not marked"}</span></header>}
          <p className={styles.approach}><Inline text={part.approach} texPayload={texPayload} /></p>
          <ol className={styles.steps}>
            {part.steps.map((step, index) => (
              <li key={index} className={styles.step}>
                <div className={styles.stepBody}>
                  <Inline text={step.text} texPayload={texPayload} />
                  {step.math && (texPayload
                    ? <ExplanationMath className={styles.display} tex={step.math} />
                    : <div className={styles.display} dangerouslySetInnerHTML={{ __html: renderDisplayMath(step.math) }} />)}
                  {step.code && <pre className={styles.code}><code>{step.code}</code></pre>}
                </div>
                {step.marks.length > 0 && <span className={styles.marks} aria-label={`Earns ${step.marks.join(", ")}`}>{step.marks.map((code, i) => <b key={`${code}-${i}`}>{code}</b>)}</span>}
              </li>
            ))}
          </ol>
          <p className={styles.answer}><span className={styles.tag}>Answer</span><Inline text={part.answer} texPayload={texPayload} /></p>
          {part.mistake && <p className={styles.mistake}><span className={styles.tag}>Watch out</span><Inline text={part.mistake} texPayload={texPayload} /></p>}
        </section>
      ))}
      {revise && explanation.parts.some((part) => part.mistake) && <p className={styles.revise}><a href={revise.href}>Revise {revise.label}</a></p>}
    </div>
  );
}
