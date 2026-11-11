"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MathHtml } from "./MathHtml";
import { useNotesContext } from "./notes-context";
import { trackGlossaryOpen } from "./track";
import styles from "./course-notes.module.css";

type Props = {
  id: string;
  label: string;
  /** Inline text (`$tex$` and all); rendered when the pop-up opens. */
  definition: string;
  lessonItem: string;
  lessonHref: string;
};

export function GlossaryTerm({ id, label, definition, lessonItem, lessonHref }: Props) {
  const ctx = useNotesContext();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onPointer);
    };
  }, [open]);

  return (
    <span ref={wrapper} className={styles.termWrap} data-term={id}>
      <button ref={button} type="button" className={styles.term} aria-expanded={open} aria-controls={open ? popId : undefined} onClick={() => {
          if (!open) trackGlossaryOpen(ctx, id);
          setOpen((v) => !v);
        }}>
        {label}
      </button>
      {open ? (
        <span id={popId} role="dialog" aria-label={label} className={styles.pop}>
          <b>{label}</b>
          <MathHtml text={definition} />
          <Link href={lessonHref}>Learn it in {lessonItem} →</Link>
        </span>
      ) : null}
    </span>
  );
}
