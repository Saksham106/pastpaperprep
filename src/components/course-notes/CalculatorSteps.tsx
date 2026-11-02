"use client";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./course-notes.module.css";

const MODELS = [
  { key: "ti84", label: "TI-84" },
  { key: "nspire", label: "TI-Nspire" },
  { key: "casio", label: "Casio" },
] as const;
type Model = (typeof MODELS)[number]["key"];
const STORAGE_KEY = "notes-calc";

export function CalculatorSteps({ steps }: { steps: Record<Model, ReactNode[]> }) {
  // Start on the default so server and client markup match, then adopt the saved choice.
  const [model, setModel] = useState<Model>("ti84");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      if (MODELS.some((m) => m.key === saved)) setModel(saved as Model);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);

  const choose = (next: Model) => {
    setModel(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode: the choice just won't persist */
    }
  };

  return (
    <aside className={`${styles.side} ${styles.sideCalc}`}>
      <b>Check on your calculator</b>
      <div className={styles.calcTabs}>
        {MODELS.map((m) => (
          <button key={m.key} type="button" aria-pressed={model === m.key} onClick={() => choose(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <ol className={styles.calcSteps}>
        {steps[model].map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </aside>
  );
}
