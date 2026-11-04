"use client";

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
  const [active, setActive] = useState(-1);
  // Escape closes the list but keeps the query; typing again reopens it.
  const [dismissed, setDismissed] = useState(false);
  const hits = searchItems(items, query).slice(0, 8);
  const open = query.trim() !== "" && !dismissed;
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

  const optionId = (index: number) => `${listId}-opt-${index}`;
  // Rows with no lesson yet are listed but cannot be reached with the arrow keys.
  const selectable = hits.flatMap((entry, index) => (entry.href ? [index] : []));
  const move = (direction: 1 | -1) => {
    if (!selectable.length) return;
    const at = selectable.indexOf(active);
    const next = at === -1 ? (direction === 1 ? 0 : selectable.length - 1) : (at + direction + selectable.length) % selectable.length;
    setActive(selectable[next]);
  };
  const go = (entry: HomeItem | undefined) => {
    report();
    if (entry?.href) router.push(entry.href);
  };
  const activeId = open && active >= 0 && active < hits.length ? optionId(active) : undefined;
  const summary = !open ? "" : hits.length ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : `No lesson matches ${query.trim()}`;

  return (
    <div className={styles.searchWrap}>
      <label className={styles.search}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          type="search"
          role="combobox"
          value={query}
          placeholder="What are you learning in class? Try “2.5” or “by parts”"
          aria-label="Search lessons"
          aria-autocomplete="list"
          aria-expanded={open && hits.length > 0}
          aria-controls={open && hits.length > 0 ? listId : undefined}
          aria-activedescendant={activeId}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
            setDismissed(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              if (open) {
                event.preventDefault();
                setDismissed(true);
                setActive(-1);
              } else {
                setQuery("");
              }
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (dismissed) setDismissed(false);
              move(event.key === "ArrowDown" ? 1 : -1);
            } else if (event.key === "Enter") {
              go(activeId ? hits[active] : hits.find((entry) => entry.href));
            }
          }}
        />
      </label>
      <div role="status" className={styles.srOnly}>{summary}</div>
      {open && hits.length ? (
        <ul id={listId} role="listbox" className={styles.searchResults} aria-label="Search results">
          {hits.map((entry, index) => (
            <li
              key={entry.item}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              aria-disabled={entry.href ? undefined : true}
              data-active={index === active ? "" : undefined}
              className={entry.href ? styles.searchOption : styles.searchUnwritten}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => go(entry)}
            >
              <span className={styles.mono}>{entry.item}</span> {entry.name}
              {entry.level === "AHL" ? <span className={styles.ahlBadge}>AHL</span> : null}
              {entry.href ? null : <em>Not written yet</em>}
            </li>
          ))}
        </ul>
      ) : null}
      {open && !hits.length ? (
        <p className={`${styles.searchResults} ${styles.searchNone}`} aria-hidden="true">No lesson matches “{query.trim()}”</p>
      ) : null}
    </div>
  );
}
