"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useNotesContext } from "./notes-context";
import { trackSearch } from "./track";
import styles from "./course-notes.module.css";

export type HomeItem = {
  item: string;
  topic: number;
  level: "SL" | "AHL";
  name: string;
  /** Present only when a lesson is written. */
  href?: string;
  synonyms?: string[];
};

/** Quiet time after the last keystroke that counts as one finished search. */
export const SEARCH_IDLE_MS = 1000;

const NUMBER = /^\d+(\.\d*)?$/;

export function searchItems(items: HomeItem[], query: string): HomeItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (NUMBER.test(q)) {
    const hits = items.filter((entry) => entry.item.startsWith(q));
    return [...hits.filter((entry) => entry.item === q), ...hits.filter((entry) => entry.item !== q)];
  }
  return items.filter((entry) => entry.name.toLowerCase().includes(q) || (entry.synonyms ?? []).some((synonym) => synonym.toLowerCase().includes(q)));
}

export function LessonSearch({ items }: { items: HomeItem[] }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const hits = searchItems(items, query).slice(0, 8);
  const open = query.trim() !== "";
  const ctx = useNotesContext();
  // One event per search interaction: the first of idle, Enter or a result click. The query text is never sent.
  const reportedFor = useRef("");
  const found = hits.length > 0;
  const report = () => {
    if (!open || reportedFor.current === query) return;
    reportedFor.current = query;
    trackSearch(ctx, found);
  };
  useEffect(() => {
    if (query.trim() === "") {
      reportedFor.current = "";
      return;
    }
    const timer = setTimeout(() => {
      if (reportedFor.current === query) return;
      reportedFor.current = query;
      trackSearch(ctx, found);
    }, SEARCH_IDLE_MS);
    return () => clearTimeout(timer);
  }, [query, found, ctx]);
  return (
    <div className={styles.searchWrap}>
      <label className={styles.search}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          type="search"
          value={query}
          placeholder="What are you learning in class? Try “2.5” or “by parts”"
          aria-label="Search lessons"
          aria-controls={open ? listId : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
            const first = hits.find((entry) => entry.href);
            if (event.key === "Enter") {
              report();
              if (first?.href) router.push(first.href);
            }
          }}
        />
      </label>
      {open ? (
        <ul id={listId} className={styles.searchResults} aria-label="Search results">
          {hits.length ? (
            hits.map((entry) => (
              <li key={entry.item}>
                {entry.href ? (
                  <Link href={entry.href} onClick={report}>
                    <span className={styles.mono}>{entry.item}</span> {entry.name}
                    {entry.level === "AHL" ? <span className={styles.ahlBadge}>AHL</span> : null}
                  </Link>
                ) : (
                  <span className={styles.searchUnwritten}>
                    <span className={styles.mono}>{entry.item}</span> {entry.name} <em>Not written yet</em>
                  </span>
                )}
              </li>
            ))
          ) : (
            <li className={styles.searchNone}>No lesson matches “{query.trim()}”</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
