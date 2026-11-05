"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useCourse } from "./notes-context";
import styles from "./course-notes.module.css";

/** Keystrokes per calculator id; the tabs are the course's calculators (AA: TI-84, TI-Nspire, Casio). */
export function CalculatorSteps({ steps }: { steps: Record<string, ReactNode[]> }) {
  const { calculators, calculatorKey } = useCourse();
  // Start on the first model so server and client markup match, then adopt the saved choice.
  const [model, setModel] = useState<string>(calculators[0]?.id ?? "");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(calculatorKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      if (calculators.some((m) => m.id === saved)) setModel(saved as string);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, [calculators, calculatorKey]);

  const choose = (next: string) => {
    setModel(next);
    try {
      window.localStorage.setItem(calculatorKey, next);
    } catch {
      /* private mode: the choice just won't persist */
    }
  };

  return (
    <aside className={`${styles.side} ${styles.sideCalc}`}>
      <b>Check on your calculator</b>
      <div className={styles.calcTabs}>
        {calculators.map((m) => (
          <button key={m.id} type="button" aria-pressed={model === m.id} onClick={() => choose(m.id)}>
            {m.name}
          </button>
        ))}
      </div>
      <ol className={styles.calcSteps}>
        {(steps[model] ?? []).map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </aside>
  );
}
