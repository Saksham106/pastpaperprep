"use client";

import { useEffect, useState } from "react";

type Worksheet = { id: string; bank_slug: string; title: string; question_ids: string[]; content_mode: "questions" | "answers" | "both"; revision: number; updated_at: string };

export function WorksheetList() {
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
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

  async function remove(item: Worksheet) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    setBusy(item.id); setError("");
    try {
      const response = await fetch(`/api/worksheets/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setWorksheets((current) => current.filter((row) => row.id !== item.id));
    } catch { setError("Could not delete this worksheet. Please try again."); }
    finally { setBusy(null); }
  }

  return <section className="saved-worksheets" aria-label="Saved worksheets">
    {error && <p role="alert" className="saved-worksheets-error">{error}</p>}
    {loading ? <p role="status">Loading worksheets…</p> : worksheets.length === 0 ? <p className="saved-worksheets-empty">No saved worksheets yet. Save a question set from any bank to find it here.</p> : <ul className="saved-worksheets-list">{worksheets.map((item) => <li className="saved-worksheet-card" key={item.id}>
      <div className="saved-worksheet-info"><h3>{item.title}</h3><p>{item.bank_slug.replaceAll("-", " ")} · {item.question_ids.length} {item.question_ids.length === 1 ? "question" : "questions"}</p><time dateTime={item.updated_at}>Edited {new Date(item.updated_at).toLocaleDateString()}</time></div>
      <div className="saved-worksheet-actions"><a className="saved-worksheet-action saved-worksheet-action-open" aria-label={`Open ${item.title}`} href={`/banks/${encodeURIComponent(item.bank_slug)}?worksheet=${encodeURIComponent(item.id)}`}>Open</a><a className="saved-worksheet-action saved-worksheet-action-edit" aria-label={`Edit ${item.title}`} href={`/banks/${encodeURIComponent(item.bank_slug)}?worksheet=${encodeURIComponent(item.id)}&mode=edit`}>Edit</a><button className="saved-worksheet-action saved-worksheet-action-delete" type="button" aria-label={`Delete ${item.title}`} disabled={busy === item.id} onClick={() => void remove(item)}>Delete</button></div>
    </li>)}</ul>}
  </section>;
}
