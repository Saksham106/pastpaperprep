"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Worksheet = { id: string; bank_slug: string; title: string; question_ids: string[]; content_mode: "questions" | "answers" | "both"; revision: number; updated_at: string };

export function WorksheetList() {
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
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

  async function rename(item: Worksheet) {
    const title = name.trim();
    if (!title) { setError("Enter a worksheet name."); return; }
    setBusy(item.id); setError("");
    try {
      const response = await fetch(`/api/worksheets/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ bank: item.bank_slug, name: title, questionIds: item.question_ids, contentMode: item.content_mode, revision: item.revision }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setWorksheets((current) => current.map((row) => row.id === item.id ? (data.worksheet ?? { ...row, title, revision: row.revision + 1 }) : row));
      setEditing(null);
    } catch { setError("Could not rename this worksheet. Reload and try again."); }
    finally { setBusy(null); }
  }
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

  return <section className="saved-worksheets" aria-labelledby="saved-worksheets-heading">
    <div className="saved-worksheets-heading"><div><p className="eyebrow">Your work</p><h2 id="saved-worksheets-heading">My worksheets</h2></div></div>
    {error && <p role="alert" className="saved-worksheets-error">{error}</p>}
    {loading ? <p role="status">Loading worksheets…</p> : worksheets.length === 0 ? <p className="saved-worksheets-empty">No saved worksheets yet. Save a question set from any bank to find it here.</p> : <ul className="saved-worksheets-list">{worksheets.map((item) => <li className="saved-worksheet-card" key={item.id}>
      <div className="saved-worksheet-info">{editing === item.id ? <form onSubmit={(event) => { event.preventDefault(); void rename(item); }}><label htmlFor={`worksheet-name-${item.id}`}>Worksheet name</label><input id={`worksheet-name-${item.id}`} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoFocus /><button type="submit" disabled={busy === item.id}>Save name</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></form> : <><h3>{item.title}</h3><p>{item.bank_slug.replaceAll("-", " ")} · {item.question_ids.length} {item.question_ids.length === 1 ? "question" : "questions"}</p><time dateTime={item.updated_at}>Edited {new Date(item.updated_at).toLocaleDateString()}</time></>}</div>
      {editing !== item.id && <div className="saved-worksheet-actions"><Link className="button secondary" aria-label={`Open ${item.title}`} href={`/banks/${encodeURIComponent(item.bank_slug)}?worksheet=${encodeURIComponent(item.id)}`}>Open</Link><button type="button" disabled={busy === item.id} onClick={() => { setName(item.title); setEditing(item.id); }}>Rename {item.title}</button><button type="button" disabled={busy === item.id} onClick={() => void remove(item)}>Delete {item.title}</button></div>}
    </li>)}</ul>}
  </section>;
}
