"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./MarketingHome.module.css";

export type QualificationTabItem = { id: string; label: string; panel: ReactNode };
/** An optional second switch (e.g. By topic / Full papers) beside the tabs; the active id lands on the root's data-mode. */
export type QualificationMode = { id: string; label: string };

export function QualificationTabs({
  items,
  ariaLabel = "Choose a qualification",
  className = "",
  modes,
  onModeChange,
}: {
  items: readonly QualificationTabItem[];
  ariaLabel?: string;
  className?: string;
  modes?: readonly QualificationMode[];
  onModeChange?: (mode: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState(modes?.[0]?.id);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const safeIndex = items.length ? Math.min(activeIndex, items.length - 1) : 0;
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!items.length) return;
    const next = event.key === "ArrowRight" ? (index + 1) % items.length
      : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length
      : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setActiveIndex(next);
    tabsRef.current[next]?.focus();
  };
  const activeMode = modes?.some((m) => m.id === mode) ? mode : modes?.[0]?.id;
  return <div className={`${styles.qualificationSwitcher} qualification-tabs-prominent ${className}`} data-mode={activeMode}>
    <div className="qualification-tab-bar">
      <div className={styles.qualificationTabs} role="tablist" aria-label={ariaLabel}>
        {items.map((item, index) => <button className={styles.qualificationTab} key={item.id} id={`${item.id}-tab`} ref={(node) => { tabsRef.current[index] = node; }} type="button" role="tab" aria-selected={safeIndex === index} aria-controls={`${item.id}-panel`} tabIndex={safeIndex === index ? 0 : -1} onClick={() => setActiveIndex(index)} onKeyDown={(event) => onKeyDown(event, index)}>{item.label}</button>)}
      </div>
      {modes && modes.length > 1 && <div className="practice-mode-switch" role="group" aria-label="Practise">
        {modes.map((m) => <button key={m.id} type="button" aria-pressed={activeMode === m.id} onClick={() => { setMode(m.id); onModeChange?.(m.id); }}>{m.label}</button>)}
      </div>}
    </div>
    {items.map((item, index) => <div className={styles.tabPanel} key={item.id} id={`${item.id}-panel`} role="tabpanel" aria-labelledby={`${item.id}-tab`} hidden={safeIndex !== index}>{item.panel}</div>)}
  </div>;
}
