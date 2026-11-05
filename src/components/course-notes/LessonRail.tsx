"use client";

import { useEffect, useState } from "react";
import styles from "./course-notes.module.css";

/** `ext`: extension content in a base lesson, hidden (with its section) in the base view. */
export type RailSection = { id: string; title: string; ext?: boolean };

/** "On this page" rail: current section and reading progress. On phones, a sticky "Contents" bar. */
export function LessonRail({ item, sections }: { item: string; sections: RailSection[] }) {
  const [current, setCurrent] = useState(sections[0]?.id ?? "");
  const [percent, setPercent] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      let cur = sections[0]?.id ?? "";
      for (const section of sections) {
        const el = document.getElementById(section.id);
        // An extension section is hidden in the base view, so it must not become "current" there.
        const hidden = section.ext && el?.closest("[data-base-view]");
        if (el && !hidden && el.getBoundingClientRect().top < 140) cur = section.id;
      }
      setCurrent(cur);
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      setPercent(max > 0 ? Math.min(100, Math.max(0, Math.round((100 * root.scrollTop) / max))) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);

  const index = Math.max(0, sections.findIndex((section) => section.id === current));
  const list = (
    <ol>
      {sections.map((section) => (
        <li key={section.id} data-ext={section.ext ? "" : undefined}>
          <a href={`#${section.id}`} aria-current={section.id === current ? "true" : undefined} onClick={() => setOpen(false)}>{section.title}</a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <div className={styles.mobileToc} data-mobile-toc>
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span><b>{item}</b> · Contents {open ? "▾" : "▸"}</span>
          <span className={styles.mono}>{index + 1} of {sections.length}</span>
        </button>
        {open ? list : null}
      </div>
      <nav className={styles.rail} aria-label="On this page">
        <div className={styles.railTitle}>ON THIS PAGE</div>
        {list}
        <div className={styles.railProg}>
          Reading progress
          <i role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><b style={{ width: `${percent}%` }} /></i>
        </div>
      </nav>
    </>
  );
}
