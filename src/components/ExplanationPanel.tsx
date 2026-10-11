"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import type { Explanation } from "@/lib/explanation-format";
import styles from "./ExplanationPanel.module.css";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char]);

/** Plain text with inline `$...$` maths. Text is escaped; maths goes through KaTeX. */
export function renderInlineMath(text: string): string {
  const segments = text.split(/(?<!\\)\$/);
  if (segments.length % 2 === 0) return escapeHtml(text);
  return segments.map((segment, index) => index % 2
    ? katex.renderToString(segment, { throwOnError: false, strict: "ignore", output: "html" })
    : escapeHtml(segment)).join("");
}

function renderDisplayMath(tex: string): string {
  return katex.renderToString(tex, { throwOnError: false, strict: "ignore", displayMode: true, output: "html" });
}

/** "a(ii)" -> "(a)(ii)"; "" stays empty. */
export function formatPartLabel(label: string): string {
  const match = /^([a-z])(\(([ivx]+)\))?$/.exec(label);
  if (!match) return label;
  return `(${match[1]})${match[3] ? `(${match[3]})` : ""}`;
}

function Inline({ text, className }: { text: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderInlineMath(text) }} />;
}

export default function ExplanationPanel({ explanation }: { explanation: Explanation }) {
  const multiPart = explanation.parts.length > 1 || explanation.parts[0]?.label !== "";
  return (
    <div className={styles.parts}>
      {explanation.parts.map((part) => (
        <section key={part.label || "whole"} className={styles.part} aria-label={multiPart ? `Part ${formatPartLabel(part.label)}` : "Worked solution"}>
          {multiPart && <header className={styles.partHeader}><strong>{formatPartLabel(part.label)}</strong><span>{part.marks} {part.marks === 1 ? "mark" : "marks"}</span></header>}
          <p className={styles.approach}><Inline text={part.approach} /></p>
          <ol className={styles.steps}>
            {part.steps.map((step, index) => (
              <li key={index} className={styles.step}>
                <div className={styles.stepBody}>
                  <Inline text={step.text} />
                  {step.math && <div className={styles.display} dangerouslySetInnerHTML={{ __html: renderDisplayMath(step.math) }} />}
                </div>
                {step.marks.length > 0 && <span className={styles.marks} aria-label={`Earns ${step.marks.join(", ")}`}>{step.marks.map((code, i) => <b key={`${code}-${i}`}>{code}</b>)}</span>}
              </li>
            ))}
          </ol>
          <p className={styles.answer}><span className={styles.tag}>Answer</span><Inline text={part.answer} /></p>
          {part.mistake && <p className={styles.mistake}><span className={styles.tag}>Watch out</span><Inline text={part.mistake} /></p>}
        </section>
      ))}
    </div>
  );
}
