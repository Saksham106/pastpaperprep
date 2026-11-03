"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
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

type Result = { ok: boolean; picked?: number; invalid?: boolean } | null;

/** Plain numbers, a Unicode minus, or a simple fraction like 1/2 or −3/4. Null when it is none of these. */
export function parseNumeric(raw: string): number | null {
  const text = raw.trim().replace(/[\u2212\u2013]/g, "-").replace(/\s+/g, "");
  const plain = /^[+-]?(\d+\.?\d*|\.\d+)$/;
  if (plain.test(text)) return Number(text);
  const fraction = /^([+-]?(?:\d+\.?\d*|\.\d+))\/(\d+\.?\d*|\.\d+)$/.exec(text);
  if (!fraction || Number(fraction[2]) === 0) return null;
  return Number(fraction[1]) / Number(fraction[2]);
}

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
  const hintRef = useRef<HTMLParagraphElement>(null);
  // The Hint button unmounts when clicked, so move focus to the hint it revealed instead of dropping it on the page.
  useEffect(() => {
    if (showHint) hintRef.current?.focus();
  }, [showHint]);
  const [typed, setTyped] = useState("");
  const inputId = `${id}-input`;

  const submitNumber = () => {
    if (!answer) return;
    const value = parseNumeric(typed);
    if (value === null) {
      setResult({ ok: false, invalid: true });
      return;
    }
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
      {hint && showHint ? (
        <p ref={hintRef} tabIndex={-1} className={styles.hintText}>
          <span className={styles.srOnly}>Hint: </span>
          {hint}
        </p>
      ) : null}
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
        {result?.invalid ? (
          <b>Enter a number, like 2.5, −3 or 1/2.</b>
        ) : result ? (
          <>
            <b>{result.ok ? "Correct." : "Not quite."}</b> {explain}
          </>
        ) : null}
      </div>
    </div>
  );
}
