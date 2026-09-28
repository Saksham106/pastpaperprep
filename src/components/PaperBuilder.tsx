"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BankSlug } from "@/lib/banks";
import { deriveCourseRoute, matchesCourseRoute, supportsCourseRoute, type CourseRouteSelection } from "@/lib/course-route";
import type { PublicBankIndex, PublicQuestionMetadata } from "@/lib/question-index";
import { generatePaper, type PaperCandidate } from "@/lib/paper-builder";
import { PaperPreview } from "@/components/PaperPreview";
import "./paper-builder.css";

type BuilderBank = { slug: BankSlug; label: string; indexUrl: string };
type Draft = { questions: PaperCandidate[]; totalMarks: number };
const SESSION_LABELS: Record<string, string> = { s: "June", w: "November", m: "March" };

function MultiPicker({ title, options, selected, onChange, disabled = false }: { title: string; options: string[]; selected: string[]; onChange: (next: string[]) => void; disabled?: boolean }) {
  const [search, setSearch] = useState("");
  const filtered = options.filter((option) => option.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <details className="paper-builder-picker">
    <summary>{title}<span>{selected.length ? `${selected.length} selected` : "All"}</span></summary>
    <div className="paper-builder-picker-panel"><input type="search" aria-label={`Search ${title.toLowerCase()}`} placeholder={`Find ${title.toLowerCase()}…`} value={search} disabled={disabled} onChange={(event) => setSearch(event.target.value)} />
      {selected.length > 0 && <button type="button" className="paper-builder-picker-clear" disabled={disabled} onClick={() => onChange([])}>Clear selection</button>}
      <div className="paper-builder-picker-options" role="group" aria-label={title}>{filtered.length ? filtered.map((option) => <label key={option}><input type="checkbox" disabled={disabled} checked={selected.includes(option)} onChange={() => onChange(selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option])} /><span>{option}</span></label>) : <p>No matching {title.toLowerCase()}.</p>}</div>
    </div>
  </details>;
}

export function PaperBuilder({ banks }: { banks: BuilderBank[] }) {
  const [bank, setBank] = useState<BankSlug | "">(banks[0]?.slug ?? "");
  const [questions, setQuestions] = useState<PublicQuestionMetadata[]>([]);
  const [loading, setLoading] = useState(Boolean(banks.length));
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"questions" | "marks">("questions");
  const [courseRoute, setCourseRoute] = useState<CourseRouteSelection>("all");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [subtopics, setSubtopics] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<number, number>>({});
  const [name, setName] = useState(banks[0] ? `${banks[0].label} practice paper` : "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const generatedRef = useRef<HTMLElement>(null);
  const previewButtonRef = useRef<HTMLButtonElement>(null);
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
  const topicOptions = useMemo(() => [...new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]))].filter(Boolean).sort(), [questions]);
  const subtopicOptions = useMemo(() => [...new Set(questions.filter((question) => !topics.length || topics.some((value) => question.primaryTopic === value || question.secondaryTopics.includes(value))).flatMap((question) => question.subtopics))].filter(Boolean).sort(), [questions, topics]);
  const visiblePapers = papers.filter((paper) => !supportsCourseRoute(bank || undefined) || matchesCourseRoute(deriveCourseRoute(bank as BankSlug, paper), courseRoute));
  const byId = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
  const previewQuestions = draft?.questions.map((question) => byId.get(question.id)).filter((question): question is PublicQuestionMetadata => Boolean(question)) ?? [];
  const routed = supportsCourseRoute(bank || undefined);
  const paperGroups = routed ? [
    { label: "Core theory", papers: visiblePapers.filter((paper) => paper === 1 || paper === 3) },
    { label: "Extended theory", papers: visiblePapers.filter((paper) => paper === 2 || paper === 4) },
    { label: "Practical · choose either", papers: visiblePapers.filter((paper) => paper === 5 || paper === 6) },
  ] : [{ label: "Available papers", papers: visiblePapers }];
  function resetDraft() { setDraft(null); setPreviewOpen(false); setSavedId(""); setError(""); }

  function build() {
    if (savingRef.current) return;
    resetDraft();
    if (loading || !bank) return;
    try {
      const targetRows = visiblePapers.filter((paper) => targets[paper] > 0).map((paper) => ({ paper, amount: targets[paper] }));
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const result = generatePaper(questions, {
        bank, courseRoute, mode, targets: targetRows, seed,
        yearFrom: fromYear ? Number(fromYear) : undefined,
        yearTo: toYear ? Number(toYear) : undefined,
        topics, subtopics,
      });
      setDraft(result);
      requestAnimationFrame(() => generatedRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
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

  if (!banks.length) return <div className="paper-builder-empty"><p className="eyebrow">Build a paper</p><h2>Your free account can still practise free questions.</h2><p>Paper building requires access to a question bank. Choose a plan to build and save your own practice sets.</p><a className="button primary" href="/pricing">See plans</a></div>;
  return <div className="paper-builder">
    <div className="paper-builder-setup">
      <section className="paper-builder-form" aria-label="Paper settings">
        <p className="eyebrow">01 / Question pool</p><h2>Choose your questions</h2>
        <label className="paper-builder-bank">Question bank<select value={bank} disabled={saving} onChange={(event) => {
          const next = banks.find((item) => item.slug === event.target.value);
          if (!next) return;
          setBank(next.slug); setQuestions([]); setLoading(true); setFromYear(""); setToYear(""); setTopics([]); setSubtopics([]); setTargets({}); setCourseRoute("all"); setName(`${next.label} practice paper`); resetDraft();
        }}>{banks.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
        {routed && <div className="paper-builder-route"><p className="paper-builder-field-title">Your Cambridge route</p><div className="paper-builder-route-options" role="group" aria-label="Your Cambridge route">{([
          ["all", "All papers", "Choose freely"], ["core", "Core", "Papers 1 & 3"], ["extended", "Extended", "Papers 2 & 4"],
        ] as const).map(([value, label, hint]) => <button key={value} type="button" disabled={saving} aria-pressed={courseRoute === value} onClick={() => { setCourseRoute(value); setTargets((current) => Object.fromEntries(Object.entries(current).filter(([paper]) => value === "all" || matchesCourseRoute(deriveCourseRoute(bank as BankSlug, Number(paper)), value)))); resetDraft(); }}><strong>{label}</strong><small>{hint}</small></button>)}</div><p className="paper-builder-muted">Papers 5 & 6 are practical options for both routes.</p></div>}
        <fieldset className="paper-builder-year-range" disabled={saving}><legend>Exam years</legend><div><label>From year<select value={fromYear} onChange={(event) => { setFromYear(event.target.value); resetDraft(); }}><option value="">Any year</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label><label>To year<select value={toYear} onChange={(event) => { setToYear(event.target.value); resetDraft(); }}><option value="">Any year</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label></div></fieldset>
        <div className="paper-builder-filter-grid"><MultiPicker title="Topics" options={topicOptions} selected={topics} disabled={saving || loading} onChange={(next) => { const available = new Set(questions.filter((question) => !next.length || next.some((value) => question.primaryTopic === value || question.secondaryTopics.includes(value))).flatMap((question) => question.subtopics)); setTopics(next); setSubtopics((current) => current.filter((item) => available.has(item))); resetDraft(); }} /><MultiPicker title="Subtopics" options={subtopicOptions} selected={subtopics} disabled={saving || loading} onChange={(next) => { setSubtopics(next); resetDraft(); }} /></div>
        <p className="paper-builder-muted">Multiple choices within a filter broaden the set. Topics and subtopics work together.</p>
      </section>
      <section className="paper-builder-mix" aria-label="Paper mix"><p className="eyebrow">02 / Paper mix</p><h2>Set your target</h2>
        {loading ? <p role="status">Loading question options…</p> : <><fieldset className="paper-builder-mode" disabled={saving}><legend>Build by</legend><label><input type="radio" name="paper-mode" checked={mode === "questions"} onChange={() => { setMode("questions"); setTargets({}); resetDraft(); }} /> Questions</label><label><input type="radio" name="paper-mode" checked={mode === "marks"} onChange={() => { setMode("marks"); setTargets({}); resetDraft(); }} /> Exact marks</label></fieldset>
          <p className="paper-builder-muted">Enter a target for each paper. Leave 0 to skip it.</p>
          {paperGroups.filter((group) => group.papers.length).map((group) => <div className="paper-builder-paper-group" key={group.label}><h3>{group.label}</h3><div className="paper-builder-targets">{group.papers.map((paper) => <label key={paper}>Paper {paper} {mode === "questions" ? "questions" : "marks"}<input type="number" min="0" max={mode === "questions" ? 50 : 200} step="1" disabled={saving} value={targets[paper] ?? 0} onChange={(event) => { setTargets((current) => ({ ...current, [paper]: Number(event.target.value) })); resetDraft(); }} /></label>)}</div></div>)}
          <button type="button" className="button primary paper-builder-generate" disabled={saving} onClick={build}>Generate paper</button>
        </>}
        {error && <p role="alert" className="paper-builder-error">{error}</p>}
      </section>
    </div>
    {draft && <section ref={generatedRef} className="paper-builder-preview" role="region" aria-label="Generated paper preview">
      <div className="paper-builder-preview-heading"><div><p className="eyebrow">03 / Your paper</p><h2>{draft.questions.length} {draft.questions.length === 1 ? "question" : "questions"} · {draft.totalMarks} {draft.totalMarks === 1 ? "mark" : "marks"}</h2><p>Preview the actual questions and mark schemes here before saving.</p></div><button type="button" className="button secondary" disabled={saving} onClick={build}>Shuffle again</button></div>
      <div className="paper-builder-preview-actions">{!previewOpen && <button ref={previewButtonRef} type="button" className="button primary" onClick={() => setPreviewOpen(true)}>Preview paper</button>}<details className="paper-builder-question-list"><summary>Question list</summary><ol>{draft.questions.map((question) => { const source = byId.get(question.id); return <li key={question.id}><strong>Paper {question.paper} · Question {source?.number ?? "—"}</strong><span>{question.year} {SESSION_LABELS[source?.session ?? ""] ?? source?.session} · {question.marks} {question.marks === 1 ? "mark" : "marks"}</span></li>; })}</ol></details></div>
      {previewOpen && bank && previewQuestions.length === draft.questions.length && <PaperPreview key={`${bank}-${draft.questions.map((question) => question.id).join(",")}`} bank={bank} questions={previewQuestions} onClose={() => { setPreviewOpen(false); requestAnimationFrame(() => previewButtonRef.current?.focus()); }} />}
      <div className="paper-builder-save"><div><h3>Keep this set?</h3><p>Save it to My worksheets so you can practise on the site anytime.</p></div><label>Worksheet name<input maxLength={80} disabled={saving || Boolean(savedId)} value={name} onChange={(event) => setName(event.target.value)} /></label>{savedId ? <a className="button primary" href={`/banks/${bank}?worksheet=${encodeURIComponent(savedId)}`}>Open paper</a> : <button type="button" className="button primary" disabled={saving || !name.trim()} onClick={() => void save()}>{saving ? "Saving…" : "Save worksheet"}</button>}</div>
    </section>}
  </div>;
}
