"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BankSlug } from "@/lib/banks";
import type { PublicBankIndex, PublicQuestionMetadata } from "@/lib/question-index";
import { generatePaper, type PaperCandidate } from "@/lib/paper-builder";
import "./paper-builder.css";

type BuilderBank = { slug: BankSlug; label: string; indexUrl: string };
type Draft = { questions: PaperCandidate[]; totalMarks: number };
const SESSION_LABELS: Record<string, string> = { s: "June", w: "November", m: "March" };

export function PaperBuilder({ banks }: { banks: BuilderBank[] }) {
  const [bank, setBank] = useState<BankSlug | "">(banks[0]?.slug ?? "");
  const [questions, setQuestions] = useState<PublicQuestionMetadata[]>([]);
  const [loading, setLoading] = useState(Boolean(banks.length));
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"questions" | "marks">("questions");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [topic, setTopic] = useState("");
  const [targets, setTargets] = useState<Record<number, number>>({});
  const [name, setName] = useState(banks[0] ? `${banks[0].label} practice paper` : "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedId, setSavedId] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const selectedBank = banks.find((item) => item.slug === bank);

  useEffect(() => {
    if (!selectedBank) return;
    const controller = new AbortController();
    fetch(selectedBank.indexUrl, { cache: "force-cache", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Index unavailable");
        return response.json() as Promise<PublicBankIndex>;
      })
      .then((index) => {
        if (index.version !== 1 || index.bank !== selectedBank.slug || !Array.isArray(index.questions)) throw new Error("Index unavailable");
        if (!controller.signal.aborted) setQuestions(index.questions.filter((question) => question.questionImageCount > 0 && Number.isInteger(question.marks) && question.marks! > 0));
      })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load this bank’s question index. Please retry."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selectedBank]);

  const years = useMemo(() => [...new Set(questions.map((question) => question.year))].sort((a, b) => b - a), [questions]);
  const papers = useMemo(() => [...new Set(questions.map((question) => question.paper))].sort((a, b) => a - b), [questions]);
  const topics = useMemo(() => [...new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]))].filter(Boolean).sort(), [questions]);
  const byId = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
  function resetDraft() { setDraft(null); setSavedId(""); setError(""); }

  function build() {
    resetDraft();
    if (loading || !bank) return;
    try {
      const targetRows = papers.filter((paper) => targets[paper] > 0).map((paper) => ({ paper, amount: targets[paper] }));
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const result = generatePaper(questions, {
        mode, targets: targetRows, seed,
        yearFrom: fromYear ? Number(fromYear) : undefined,
        yearTo: toYear ? Number(toYear) : undefined,
        topics: topic ? [topic] : [],
      });
      setDraft(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not make this paper"); }
  }

  async function save() {
    if (!draft || !bank || savingRef.current || savedId) return;
    if (!name.trim() || name.trim().length > 80) { setError("Name must be 1–80 characters"); return; }
    savingRef.current = true;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/worksheets", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bank, name: name.trim(), questionIds: draft.questions.map((question) => question.id), contentMode: "both" }),
      });
      const payload = await response.json();
      if (!response.ok || typeof payload.worksheet?.id !== "string") throw new Error(typeof payload.error === "string" ? payload.error : "Could not save this worksheet");
      setSavedId(payload.worksheet.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this worksheet"); }
    finally { savingRef.current = false; setSaving(false); }
  }

  if (!banks.length) return <div className="paper-builder-empty"><p>You need access to a question bank to build a paper.</p><a className="button secondary" href="/pricing">Explore bank plans</a></div>;
  return <div className="paper-builder">
    <section className="paper-builder-form" aria-label="Paper settings">
      <div className="paper-builder-fields">
        <label>Question bank<select value={bank} onChange={(event) => {
          const next = banks.find((item) => item.slug === event.target.value);
          if (!next) return;
          setBank(next.slug); setQuestions([]); setLoading(true); setFromYear(""); setToYear(""); setTopic(""); setTargets({}); setName(`${next.label} practice paper`); resetDraft();
        }}>{banks.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
        <label>From year<select value={fromYear} onChange={(event) => { setFromYear(event.target.value); resetDraft(); }}><option value="">Any year</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
        <label>To year<select value={toYear} onChange={(event) => { setToYear(event.target.value); resetDraft(); }}><option value="">Any year</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
        <label>Topic<select value={topic} onChange={(event) => { setTopic(event.target.value); resetDraft(); }}><option value="">Any topic</option>{topics.map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>
      {loading ? <p role="status">Loading question options…</p> : <>
        <fieldset className="paper-builder-mode"><legend>Build by</legend><label><input type="radio" name="paper-mode" checked={mode === "questions"} onChange={() => { setMode("questions"); setTargets({}); resetDraft(); }} /> Number of questions</label><label><input type="radio" name="paper-mode" checked={mode === "marks"} onChange={() => { setMode("marks"); setTargets({}); resetDraft(); }} /> Exact marks</label></fieldset>
        <p className="paper-builder-help">Set an amount for each paper you want. Leave the others at 0.</p>
        <div className="paper-builder-targets">{papers.map((paper) => <label key={paper}>Paper {paper} {mode === "questions" ? "questions" : "marks"}<input type="number" min="0" max={mode === "questions" ? 50 : 200} step="1" value={targets[paper] ?? 0} onChange={(event) => { setTargets((current) => ({ ...current, [paper]: Number(event.target.value) })); resetDraft(); }} /></label>)}</div>
        <button type="button" className="button primary" onClick={build}>Generate paper</button>
      </>}
      {error && <p role="alert" className="paper-builder-error">{error}</p>}
    </section>
    {draft && <section className="paper-builder-preview" role="region" aria-label="Generated paper preview">
      <div className="paper-builder-preview-heading"><div><p className="eyebrow">Generated paper</p><h2>{draft.questions.length} questions · {draft.totalMarks} marks</h2></div><button type="button" className="button secondary" onClick={build}>Shuffle again</button></div>
      <ol>{draft.questions.map((question) => { const source = byId.get(question.id); return <li key={question.id}><strong>Paper {question.paper} · Question {source?.number ?? "—"}</strong><span>{question.year} {SESSION_LABELS[source?.session ?? ""] ?? source?.session} · {question.marks} {question.marks === 1 ? "mark" : "marks"}</span></li>; })}</ol>
      <p>Save to open and practise this set on the site. Reveal answers as you go.</p>
      <div className="paper-builder-save"><label>Worksheet name<input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>{savedId ? <a className="button primary" href={`/banks/${bank}?worksheet=${encodeURIComponent(savedId)}`}>Open paper</a> : <button type="button" className="button primary" disabled={saving || !name.trim()} onClick={() => void save()}>{saving ? "Saving…" : "Save worksheet"}</button>}</div>
    </section>}
  </div>;
}
