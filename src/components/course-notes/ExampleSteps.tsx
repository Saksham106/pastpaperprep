"use client";
import { useState, type ReactNode } from "react";
import { useNotesContext } from "./notes-context";
import { trackExampleStep } from "./track";
import styles from "./course-notes.module.css";

type Props = {
  id: string;
  question: ReactNode;
  steps: ReactNode[];
  answer: ReactNode;
  /** Shown only once every step and the answer are visible. */
  check?: ReactNode;
};

export function ExampleSteps({ id, question, steps, answer, check }: Props) {
  const all = [...steps, answer];
  const ctx = useNotesContext();
  const [shown, setShown] = useState(1);
  const done = shown >= all.length;
  const heading = `${id}-heading`;
  return (
    <section className={styles.example} aria-labelledby={heading}>
      <div className={styles.exHead}>
        <b id={heading}>Worked example</b>
        <span>{question}</span>
      </div>
      <p className={styles.try}>Try it first, then reveal one step at a time.</p>
      <ol className={styles.steps}>
        {all.slice(0, shown).map((step, i) => (
          <li key={i} className={i === all.length - 1 ? styles.ans : undefined}>
            {step}
          </li>
        ))}
      </ol>
      {done ? null : (
        <div className={styles.exCtrl}>
          <button type="button" className={styles.btnQuiet} onClick={() => {
              trackExampleStep(ctx, id, Math.min(shown + 1, all.length));
              setShown((n) => Math.min(n + 1, all.length));
            }}>
            Show next step
          </button>
          <button type="button" className={styles.link} onClick={() => {
              trackExampleStep(ctx, id, "all");
              setShown(all.length);
            }}>
            Show all
          </button>
        </div>
      )}
      {done && check ? <div className={styles.exCheck}>{check}</div> : null}
    </section>
  );
}
