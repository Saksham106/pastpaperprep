"use client";

import { useEffect, useRef, useState } from "react";
import "./worksheet-workspace.css";

type Worksheet = { id: string; bank_slug: string; title: string; question_ids: string[]; content_mode: "questions" | "answers" | "both"; revision: number; updated_at: string };

export function WorksheetList() {
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Worksheet | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const deletingRef = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/worksheets").then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (active) setWorksheets(data.worksheets);
    }).catch(() => { if (active) setError("Could not load your worksheets. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [pending]);

  function restoreFocus() {
    if (triggerRef.current?.isConnected) triggerRef.current.focus();
    else document.querySelector<HTMLElement>(".saved-worksheet-action, .worksheet-library-header a")?.focus();
  }

  async function remove(item: Worksheet) {
    if (deletingRef.current) return;
    deletingRef.current = item.id;
    setBusy(item.id); setDeleteError("");
    try {
      const response = await fetch(`/api/worksheets/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setWorksheets((current) => current.filter((row) => row.id !== item.id));
      setPending(null);
      requestAnimationFrame(restoreFocus);
    } catch { setDeleteError("Could not delete this worksheet. Please try again."); }
    finally { deletingRef.current = null; setBusy(null); }
  }

  return <section className="saved-worksheets" aria-label="Saved worksheets">
    {error && <p role="alert" className="saved-worksheets-error">{error}</p>}
    {loading ? <p role="status">Loading worksheets…</p> : worksheets.length === 0 ? <p className="saved-worksheets-empty">No saved worksheets yet. Save a question set from any bank to find it here.</p> : <ul className="saved-worksheets-list">{worksheets.map((item) => <li className="saved-worksheet-card" key={item.id}>
      <div className="saved-worksheet-info"><h3>{item.title}</h3><p>{item.bank_slug.replaceAll("-", " ")} · {item.question_ids.length} {item.question_ids.length === 1 ? "question" : "questions"}</p><time dateTime={item.updated_at}>Edited {new Date(item.updated_at).toLocaleDateString()}</time></div>
      <div className="saved-worksheet-actions"><a className="saved-worksheet-action saved-worksheet-action-open" aria-label={`Open ${item.title}`} href={`/banks/${encodeURIComponent(item.bank_slug)}?worksheet=${encodeURIComponent(item.id)}`}>Open</a><a className="saved-worksheet-action saved-worksheet-action-edit" aria-label={`Edit ${item.title}`} href={`/banks/${encodeURIComponent(item.bank_slug)}?worksheet=${encodeURIComponent(item.id)}&mode=edit`}>Edit</a><button className="saved-worksheet-action saved-worksheet-action-delete" type="button" aria-label={`Delete ${item.title}`} disabled={busy === item.id} onClick={(event) => { triggerRef.current = event.currentTarget; setDeleteError(""); setPending(item); }}>Delete</button></div>
    </li>)}</ul>}
    {pending && <dialog ref={dialogRef} className="worksheet-unsaved-dialog worksheet-delete-dialog" aria-labelledby="worksheet-delete-title" aria-describedby="worksheet-delete-description"
      onCancel={(event) => { if (busy) event.preventDefault(); }}
      onClose={() => { setPending(null); restoreFocus(); }}>
      <p className="eyebrow">My worksheets</p>
      <h2 id="worksheet-delete-title">Delete “{pending.title}”?</h2>
      <p id="worksheet-delete-description">This worksheet will be permanently deleted. You can’t undo this.</p>
      {deleteError && <p role="alert">{deleteError}</p>}
      <div className="worksheet-unsaved-actions">
        <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={() => dialogRef.current?.close()}>Keep worksheet</button>
        <button type="button" className="button worksheet-confirm-delete" disabled={Boolean(busy)} onClick={() => void remove(pending)}>{busy ? "Deleting…" : "Delete worksheet"}</button>
      </div>
    </dialog>}
  </section>;
}
