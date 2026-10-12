"use client";

import { useEffect, useRef, useState } from 'react';
import { PAPER_MARKING_PREVIEW } from '@/lib/paper-marking-preview';
import { createPaperMarkingReport, topicPracticeHref, type QuestionMarks, type TopicReview, type MarkingManifest } from '@/lib/paper-marking-report';
import styles from './PaperMarkingWorkspace.module.css';

export type PaperMarkingPaper = MarkingManifest & { id: string; version: string; bankSlug: string; title: string };

function TopicEvidence({ topic, bankSlug }: { topic: TopicReview; bankSlug: string }) {
  return <li className={styles.topic}>
    <h4>{topic.topic}</h4>
    <p className={styles.note}>{topic.lostEvidence.length === 1 ? 'Single-question evidence' : `Lost marks in ${topic.lostEvidence.length} questions`} · {topic.exposureCount} marked question{topic.exposureCount === 1 ? '' : 's'} involving this topic</p>
    <details><summary>Show question evidence</summary>
      <ul>{topic.lostEvidence.map(q => <li key={q.questionId}>Q{q.number}: {q.earned} / {q.maxMarks} marks</li>)}</ul>
      {topic.fullMarkEvidence.length > 0 && <p>Also full marks on {topic.fullMarkEvidence.map(q => `Q${q.number} (${q.earned} / ${q.maxMarks})`).join(', ')}.</p>}
    </details>
    <a className={styles.practice} href={topicPracticeHref(topic.topic, bankSlug)} aria-label={`Practise ${topic.topic} - free preview`}>Practise this topic <span aria-hidden="true">→</span></a>
  </li>;
}

export function PaperMarkingWorkspace({ paper = PAPER_MARKING_PREVIEW }: { paper?: PaperMarkingPaper }) {
  return <PaperMarkingSession key={JSON.stringify([paper.id, paper.version])} paper={paper} />;
}

function PaperMarkingSession({ paper }: { paper: PaperMarkingPaper }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showReport, setShowReport] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [storageFailure, setStorageFailure] = useState(false);
  const restored = useRef(false);
  // The keyed session restores once; ordinary parent rerenders must not erase drafts.
  const restorePaper = useRef(paper);
  const clearButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const reportHeading = useRef<HTMLHeadingElement>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const previousReport = useRef(false);
  useEffect(() => {
    if (showReport) reportHeading.current?.focus();
    else if (previousReport.current) firstInput.current?.focus();
    previousReport.current = showReport;
  }, [showReport]);
  const storageKey = `pastpaperprep:marks:${paper.id}:${paper.version}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid saved marks');
        createPaperMarkingReport(restorePaper.current, parsed as QuestionMarks);
        // Hydration starts blank on server/client; restore external device state once after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValues(Object.fromEntries(Object.entries(parsed).map(([id, value]) => [id, value === null ? '' : String(value)])));
      }
    } catch { /* Corrupt/unavailable storage must never block marking. */ }
    restored.current = true;
  }, [storageKey]);
  useEffect(() => { if (confirmClear) keepButton.current?.focus(); }, [confirmClear]);
  function save(next: Record<string, string>) {
    if (!restored.current) return;
    const nextMarks: QuestionMarks = Object.fromEntries(paper.questions.map(q => [q.id, next[q.id]?.trim() ? Number(next[q.id]) : null]));
    try {
      createPaperMarkingReport(paper, nextMarks);
    } catch { return; } // Never persist invalid drafts or replace valid saved marks with them.
    try { localStorage.setItem(storageKey, JSON.stringify(nextMarks)); setStorageFailure(false); }
    catch { setStorageFailure(true); }
  }
  function update(id: string, value: string) {
    const next = { ...values, [id]: value };
    setValues(next);
    save(next);
  }
  function closeClear() { setConfirmClear(false); clearButton.current?.focus(); }
  function clear() {
    setValues({}); setShowReport(false); setShowAll(false);
    save({}); closeClear();
  }
  const marks: QuestionMarks = Object.fromEntries(paper.questions.map(q => [q.id, values[q.id]?.trim() ? Number(values[q.id]) : null]));
  const errors = Object.fromEntries(paper.questions.map(q => [q.id, marks[q.id] !== null && (!Number.isInteger(marks[q.id]) || marks[q.id]! < 0 || marks[q.id]! > q.maxMarks) ? `Enter a whole number from 0 to ${q.maxMarks}.` : '']));
  const valid = !Object.values(errors).some(Boolean);
  const report = valid ? createPaperMarkingReport(paper, marks) : null;
  return <section className={styles.workspace} aria-labelledby="paper-self-marking">
    <header><p className={styles.note}>{paper.title}</p><p className={styles.kicker}>Self-mark & review</p><h2 id="paper-self-marking">Turn your marks into a revision plan.</h2></header>
    {!showReport ? <form onSubmit={event => { event.preventDefault(); if (valid && report?.markedMaximum) setShowReport(true); }}>
      <p>Use the mark scheme above, then enter your total for each question. Leave unfinished marking blank; enter 0 only for no marks earned.</p>
      <div className={styles.inputs}>{paper.questions.map(q => <div key={q.id}>
        <label htmlFor={`marks-${q.id}`}>Question {q.number} marks</label>
        <div className={styles.inputRow}><input ref={q.number === 1 ? firstInput : undefined} id={`marks-${q.id}`} type="text" inputMode="numeric" autoComplete="off" value={values[q.id] ?? ''} onChange={event => update(q.id, event.target.value)} aria-invalid={Boolean(errors[q.id])} aria-describedby={`max-${q.id}${errors[q.id] ? ` error-${q.id}` : ''}`} /><span id={`max-${q.id}`}>/ {q.maxMarks}</span></div>
        {errors[q.id] && <p className={styles.error} id={`error-${q.id}`}>{errors[q.id]}</p>}
      </div>)}</div>
      <button className={styles.primary} disabled={!valid || !report?.markedMaximum}>See revision report</button>
    </form> : report && <div aria-live="polite">
      <div className={styles.resultHeading}><div><h3 ref={reportHeading} tabIndex={-1}>{report.complete ? `${report.markedTotal} / ${paper.maxMarks} paper marks` : `${report.markedTotal} / ${report.markedMaximum} marks on marked questions`}</h3>
      {!report.complete && <p>{report.unmarkedCount} questions unmarked. This is a partial report, not a paper score.</p>}</div><button type="button" className={styles.secondary} onClick={() => { setShowReport(false); setShowAll(false); }}>Edit marks</button></div>
      <h3>Topics to review</h3>
      {report.priorities.length ? <><ol className={styles.topics}>{(showAll ? report.priorities : report.priorities.slice(0, 3)).map(topic => <TopicEvidence key={topic.topic} topic={topic} bankSlug={paper.bankSlug} />)}</ol>
        {report.priorities.length > 3 && <button type="button" className={styles.secondary} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show top 3 only' : `Show all ${report.priorities.length} topics`}</button>}</> : <p>No revision priorities from the marked questions.</p>}
      {report.successfulTopics.length > 0 && <details className={styles.success}><summary>Areas with successful question evidence</summary><ul>{report.successfulTopics.map(topic => <li key={topic.topic}>{topic.topic}: {topic.fullMarkEvidence.map(q => `Q${q.number} (${q.earned} / ${q.maxMarks})`).join(', ')}</li>)}</ul></details>}
      <details className={styles.policy}><summary>How topics are prioritised</summary><p>More questions with lost marks than full marks come first, then repeated losses, then average relative loss in the supporting whole questions. Exact ties follow paper topic order. This is a review heuristic, not topic accuracy.</p></details>
    </div>}
    <div className={styles.storage}>
      <p className={styles.note}>{storageFailure ? 'Marks work here, but could not be saved on this device.' : 'Marks are saved on this device only. No account needed.'}</p>
      <button ref={clearButton} type="button" className={styles.secondary} onClick={() => setConfirmClear(true)}>Clear marks</button>
    </div>
    {confirmClear && <div role="group" aria-labelledby="clear-paper-marks" className={styles.confirm} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeClear(); } }}>
      <p id="clear-paper-marks">Clear all marks for this paper?</p>
      <button ref={keepButton} type="button" className={styles.secondary} onClick={closeClear}>Keep marks</button>{' '}
      <button type="button" className={styles.primary} onClick={clear}>Yes, clear marks</button>
    </div>}
    <p className={styles.note}>Self-marked. Suggestions use topics in whole questions; they do not identify which subpart lost marks.</p>
  </section>;
}
