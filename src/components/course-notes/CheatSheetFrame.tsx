"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackProductEvent } from "@/lib/product-analytics";
import { LevelSwitch, useNotesLevel } from "./LevelSwitch";
import styles from "./cheatsheet.module.css";

/** Hides the site chrome and prints the sheet on A4 with no page margin. Global on purpose: the chrome lives in the root layout. */
export const PRINT_CSS = "@media print { @page { size: A4; margin: 0; } html, body { background: #fff !important; } .site-header, .site-footer, [data-print-hide] { display: none !important; } }";

type Props = {
  title: string;
  /** Topic slug, or "course" for the whole course. */
  slug: string;
  crumbs: { label: string; href: string }[];
  children: ReactNode;
};

/** Client shell: level switch (CSS-only hiding, the server HTML stays complete) and Save as PDF. */
export function CheatSheetFrame({ title, slug, crumbs, children }: Props) {
  const [level, setLevel] = useNotesLevel();
  const print = () => {
    trackProductEvent("notes_cheatsheet_print", { topic: slug, level });
    window.print();
  };
  return (
    <div className={`${styles.page} shell`} data-cheatsheet={slug}>
      <style>{PRINT_CSS}</style>
      <div className={styles.tools} data-print-hide>
        <div className={styles.crumbs}>
          {crumbs.map((crumb) => (
            <span key={crumb.href}><Link href={crumb.href}>{crumb.label}</Link> › </span>
          ))}
          Cheat sheet
        </div>
        <h1>{title} cheat sheet</h1>
        <div className={styles.actions}>
          <LevelSwitch level={level} onChange={setLevel} />
          <button type="button" className={styles.save} onClick={print}>Save as PDF</button>
        </div>
      </div>
      <p className={styles.key} data-print-hide>
        <span className={`${styles.tg} ${styles.tgB}`}>BOOKLET</span> given in the exam
        <span className={`${styles.tg} ${styles.tgL}`}>LEARN</span> you must remember it · Each block links to its lesson.
      </p>
      <div className={styles.sheet} data-level={level} data-sheet>
        <div className={styles.head}>
          <h2>{title}</h2>
          <span>
            IB MATHS AA · {level}
            <br />
            <i>pastpaperprep.com/revision-notes</i>
          </span>
        </div>
        {children}
        <div className={styles.foot}>Follows the IB Maths AA guide (first assessment 2021). Not affiliated with the IB.</div>
      </div>
    </div>
  );
}
