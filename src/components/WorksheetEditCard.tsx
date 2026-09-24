"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PdfContent } from "@/lib/pdf-export";

type Props = {
  title: string;
  ids: string[];
  content: PdfContent;
  adding: boolean;
  busy: boolean;
  dirty: boolean;
  status: string;
  onTitle: (title: string) => void;
  onContent: (content: PdfContent) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onDoneAdding: () => void;
  onSave: () => void;
};

export function WorksheetEditCard({ title, ids, content, adding, busy, dirty, status, onTitle, onContent, onMove, onRemove, onAdd, onDoneAdding, onSave }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const beforeMove = useRef(new Map<string, number>());
  const [announcement, setAnnouncement] = useState("");
  const [movedId, setMovedId] = useState("");
  useLayoutEffect(() => {
    const before = beforeMove.current;
    if (!before.size || !listRef.current) return;
    beforeMove.current = new Map();
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const row of listRef.current.querySelectorAll<HTMLElement>("[data-question-id]")) {
      const oldY = before.get(row.dataset.questionId ?? "");
      if (oldY === undefined) continue;
      const delta = oldY - row.getBoundingClientRect().top;
      if (Math.abs(delta) > 1) row.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }, [ids]);
  useEffect(() => {
    if (!movedId) return;
    const timer = window.setTimeout(() => setMovedId(""), 450);
    return () => window.clearTimeout(timer);
  }, [movedId]);
  const move = (id: string, direction: -1 | 1) => {
    beforeMove.current = new Map([...listRef.current?.querySelectorAll<HTMLElement>("[data-question-id]") ?? []].map((row) => [row.dataset.questionId ?? "", row.getBoundingClientRect().top]));
    const position = ids.indexOf(id) + direction + 1;
    onMove(id, direction);
    setMovedId(id);
    setAnnouncement(`Question moved to position ${position} of ${ids.length}.`);
  };
  return <section className="worksheet-edit-card" aria-label="Edit worksheet">
    <label className="worksheet-name-field">Worksheet name<input aria-label="Worksheet name" maxLength={80} value={title} onChange={(event) => onTitle(event.target.value)} /></label>
    <fieldset className="worksheet-content-options"><legend>PDF content</legend>{(["questions", "answers", "both"] as PdfContent[]).map((value) => <label key={value}><input type="radio" name="worksheet-content" checked={content === value} onChange={() => onContent(value)} /> {value === "both" ? "Questions and answers" : value === "questions" ? "Questions" : "Answers"}</label>)}</fieldset>
    <div className="worksheet-edit-heading"><strong>Questions in this worksheet</strong><span>{ids.length}</span></div>
    <ol ref={listRef} className="worksheet-edit-list">{ids.map((id, index) => <li key={id} data-question-id={id} data-moved={movedId === id || undefined}><span>{id}</span><div className="worksheet-row-actions"><button type="button" aria-label={`Move question ${id} up`} disabled={index === 0} onClick={() => move(id, -1)}>↑</button><button type="button" aria-label={`Move question ${id} down`} disabled={index === ids.length - 1} onClick={() => move(id, 1)}>↓</button><button type="button" aria-label={`Remove question ${id}`} onClick={() => onRemove(id)}>Remove</button></div></li>)}</ol>
    <p role="status" aria-label="Question order" className="sr-only">{announcement}</p>
    <div className="worksheet-edit-actions"><button type="button" className="button secondary" onClick={adding ? onDoneAdding : onAdd}>{adding ? "Done adding" : "+ Add questions"}</button><button type="button" className="button primary" disabled={busy || !dirty || !title.trim() || !ids.length} onClick={onSave}>{busy ? "Saving…" : "Save changes"}</button></div>
    {status && <p role={status.toLowerCase().includes("could not") ? "alert" : "status"}>{status}</p>}
  </section>;
}
