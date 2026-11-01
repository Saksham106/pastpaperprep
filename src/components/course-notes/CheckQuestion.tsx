"use client";
import { useRef, useState, type ReactNode } from "react";
import { useNotesContext } from "./notes-context";
import { trackCheckAnswer } from "./track";
import styles from "./course-notes.module.css";

type Props = {
  id: string;
  prompt: ReactNode;
  hint?: ReactNode;
  options?: { content: ReactNode; correct: boolean }[];
  answer?: { value: number; tolerance: number };
  explain: ReactNode;
};

type Result = { ok: boolean; picked?: number } | null;

export function CheckQuestion({ id, prompt, hint, options, answer, explain }: Props) {
  const ctx = useNotesContext();
  // Distinct answers already sent for this check on this page view.
  const answered = useRef<Set<string>>(new Set());
  const record = (key: string, ok: boolean) => {
    if (answered.current.has(key)) return;
    answered.current.add(key);
    trackCheckAnswer(ctx, id, ok, answered.current.size);
  };
  const [result, setResult] = useState<Result>(null);
  const [showHint, setShowHint] = useState(false);
  const [typed, setTyped] = useState("");
  const inputId = `${id}-input`;

  const submitNumber = () => {
    const value = Number(typed.trim());
    if (!answer || typed.trim() === "" || Number.isNaN(value)) return;
    const ok = Math.abs(value - answer.value) <= answer.tolerance + 1e-9;
    record(`n:${value}`, ok);
    setResult({ ok });
  };

  return (
    <div className={styles.selfcheck}>
      <div className={styles.scHead}>Check yourself</div>
      <div>
        {prompt}
        {hint && !showHint ? (
          <>
            {" "}
            <button type="button" className={styles.link} onClick={() => setShowHint(true)}>
              Hint
            </button>
          </>
        ) : null}
      </div>
      {hint && showHint ? <p className={styles.hintText}>{hint}</p> : null}
      {options ? (
        <div className={styles.opts}>
          {options.map((option, i) => (
            <button
              key={i}
              type="button"
              data-state={result?.picked === i ? (option.correct ? "right" : "wrong") : undefined}
              onClick={() => {
                record(`o:${i}`, option.correct);
                setResult({ ok: option.correct, picked: i });
              }}
            >
              {option.content}
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.numeric}>
          <label htmlFor={inputId} className={styles.srOnly}>
            Your answer
          </label>
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNumber();
            }}
          />
          <button type="button" className={styles.btnQuiet} onClick={submitNumber}>
            Check
          </button>
        </div>
      )}
      <div data-testid="check-feedback" aria-live="polite" className={`${styles.fb} ${result ? (result.ok ? styles.fbOk : styles.fbNo) : ""}`}>
        {result ? (
          <>
            <b>{result.ok ? "Correct." : "Not quite."}</b> {explain}
          </>
        ) : null}
      </div>
    </div>
  );
}
