"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./MarketingHome.module.css";
import { onPracticeModeRequest, PRACTICE_MODE_KEY } from "@/lib/practice-mode";

export { PRACTICE_MODE_KEY };

export type Qualification = "igcse" | "ib";
export type QualificationTabItem = { id: string; label: string; panel: ReactNode; qualification?: Qualification };
/** An optional switch (e.g. By topic / Full papers) before the tabs; the active id lands on the root's data-mode. */
export type QualificationMode = { id: string; label: string; icon?: ReactNode };

/** Remembered across pages and visits: the last qualification and practice mode a visitor chose. */
export const QUALIFICATION_KEY = "ppp-qualification";
const read = (key: string) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { window.localStorage.setItem(key, value); } catch { /* private mode */ } };

export function QualificationTabs({
  items,
  ariaLabel = "Choose a qualification",
  className = "",
  modes,
  preferredQualification,
}: {
  items: readonly QualificationTabItem[];
  ariaLabel?: string;
  className?: string;
  modes?: readonly QualificationMode[];
  /** Used when the visitor hasn't picked yet, e.g. the qualification their plan covers. */
  preferredQualification?: Qualification;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState(modes?.[0]?.id);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const safeIndex = items.length ? Math.min(activeIndex, items.length - 1) : 0;
  const hasModes = Boolean(modes && modes.length > 1);

  // Restore after hydration so the server markup and the first client render agree.
  useEffect(() => {
    const stored = read(QUALIFICATION_KEY);
    const wanted = stored === "igcse" || stored === "ib" ? stored : preferredQualification;
    const index = items.findIndex((item) => item.qualification && item.qualification === wanted);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off restore from localStorage
    if (index >= 0) setActiveIndex(index);
    if (!stored && preferredQualification) write(QUALIFICATION_KEY, preferredQualification);
    const storedMode = read(PRACTICE_MODE_KEY);
    if (storedMode && modes?.some((m) => m.id === storedMode)) setMode(storedMode);
    // Only on mount: later choices are the visitor's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A link that asks for a mode (the nav's "Practice by topic") switches it even when this page is already open.
  useEffect(() => onPracticeModeRequest((id) => { if (modes?.some((m) => m.id === id)) setMode(id); }), [modes]);

  const select = (index: number) => {
    setActiveIndex(index);
    const qualification = items[index]?.qualification;
    if (qualification) write(QUALIFICATION_KEY, qualification);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!items.length) return;
    const next = event.key === "ArrowRight" ? (index + 1) % items.length
      : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length
      : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
    tabsRef.current[next]?.focus();
  };
  const chooseMode = (id: string) => { setMode(id); write(PRACTICE_MODE_KEY, id); };
  const activeMode = modes?.some((m) => m.id === mode) ? mode : modes?.[0]?.id;
  return <div className={`${styles.qualificationSwitcher} qualification-tabs-prominent ${className}`} data-mode={activeMode}>
    <div className={`qualification-tab-bar${hasModes ? " has-modes" : ""}`}>
      {hasModes && <div className="practice-mode-switch" role="radiogroup" aria-label="How do you want to practise?" data-active={modes!.findIndex((m) => m.id === activeMode)}>
        {modes!.map((m, index) => <button key={m.id} type="button" role="radio" aria-checked={activeMode === m.id} tabIndex={activeMode === m.id ? 0 : -1}
          onClick={() => chooseMode(m.id)}
          onKeyDown={(event) => {
            const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
            if (!step) return;
            event.preventDefault();
            const next = modes![(index + step + modes!.length) % modes!.length];
            chooseMode(next.id);
            (event.currentTarget.parentElement?.children[modes!.indexOf(next)] as HTMLElement | undefined)?.focus();
          }}>{m.icon}{m.label}</button>)}
      </div>}
      <div className={styles.qualificationTabs} role="tablist" aria-label={ariaLabel}>
        {items.map((item, index) => <button className={styles.qualificationTab} key={item.id} id={`${item.id}-tab`} ref={(node) => { tabsRef.current[index] = node; }} type="button" role="tab" aria-selected={safeIndex === index} aria-controls={`${item.id}-panel`} tabIndex={safeIndex === index ? 0 : -1} onClick={() => select(index)} onKeyDown={(event) => onKeyDown(event, index)}>{item.label}</button>)}
      </div>
    </div>
    {items.map((item, index) => <div className={styles.tabPanel} key={item.id} id={`${item.id}-panel`} role="tabpanel" aria-labelledby={`${item.id}-tab`} hidden={safeIndex !== index}>{item.panel}</div>)}
  </div>;
}
