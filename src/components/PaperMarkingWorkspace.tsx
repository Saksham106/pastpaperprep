"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus } from '@phosphor-icons/react/dist/ssr';
import { PAPER_MARKING_PREVIEW } from '@/lib/paper-marking-preview';
import { createPaperMarkingReport, topicPracticeHref, type QuestionMarks, type TopicReview, type MarkingManifest } from '@/lib/paper-marking-report';
import { trackProductEvent } from '@/lib/product-analytics';
import styles from './PaperMarkingWorkspace.module.css';

export type PaperMarkingPaper = MarkingManifest & { id: string; version: string; bankSlug: string; title: string };

function TopicEvidence({ topic }: { topic: TopicReview }) {
  const lost = topic.lostEvidence.length;
  return <li className={styles.topic}>
    <div className={styles.topicHead}><h4>{topic.topic}</h4><span>{topic.lostEvidence.map(q => `Q${q.number}`).join(', ')}</span></div>
    <p className={styles.note}>Lost marks in {lost} of {topic.exposureCount} {topic.exposureCount === 1 ? 'question' : 'questions'}</p>
    <span className={styles.bar} aria-hidden="true"><i style={{ width: `${Math.round(lost / topic.exposureCount * 100)}%` }} /></span>
  </li>;
}

export function PaperMarkingWorkspace({ paper = PAPER_MARKING_PREVIEW, onClose }: { paper?: PaperMarkingPaper; onClose?: () => void }) {
  return <PaperMarkingSession key={JSON.stringify([paper.bankSlug, paper.id, paper.version])} paper={paper} onClose={onClose} />;
}

function PaperMarkingSession({ paper, onClose }: { paper: PaperMarkingPaper; onClose?: () => void }) {
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
  const storageKey = `pastpaperprep:marks:${paper.bankSlug}:${paper.id}:${paper.version}`;
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
  /** − from blank means "no marks"; + from blank means one mark. Always clamped to the question's maximum. */
  function step(id: string, maxMarks: number, delta: 1 | -1) {
    const current = Number(values[id]);
    const base = values[id]?.trim() && Number.isInteger(current) ? current : delta === 1 ? 0 : 1;
    update(id, String(Math.min(maxMarks, Math.max(0, base + delta))));
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
  const top = report?.priorities[0];
  function openReport() {
    if (!valid || !report?.markedMaximum) return;
    setShowReport(true);
    trackProductEvent('past_paper_report_view', { bank: paper.bankSlug, complete: report.complete });
  }
  return <section className={styles.workspace} aria-labelledby="paper-self-marking">
    <header className={styles.header}>
      <div>
        {onClose && <button type="button" className={styles.back} onClick={onClose}><ArrowLeft aria-hidden="true" weight="bold" />Back to paper</button>}
        <p className={styles.note}>{paper.title}</p>
        <h2 id="paper-self-marking">Your marks</h2>
        <p className={styles.note}>{storageFailure ? 'Marks work here, but could not be saved on this device.' : 'Saved on this device. No account needed.'}</p>
      </div>
      <p className={styles.total} aria-label="Marks so far">{report?.markedTotal ?? 0}<span> / {paper.maxMarks}</span></p>
    </header>
    {!showReport ? <form onSubmit={event => { event.preventDefault(); openReport(); }}>
      <ol className={styles.questions}>{paper.questions.map(q => <li key={q.id} className={styles.question} data-filled={values[q.id]?.trim() && !errors[q.id] ? '' : undefined}>
        <label htmlFor={`marks-${q.id}`}><b>Q{q.number}</b><span>{q.topics[0]}</span><span className={styles.visuallyHidden}>Question {q.number} marks</span></label>
        <div className={styles.stepper}>
          <button type="button" aria-label={`Remove a mark from question ${q.number}`} onClick={() => step(q.id, q.maxMarks, -1)}><Minus aria-hidden="true" weight="bold" /></button>
          <input ref={q.number === 1 ? firstInput : undefined} id={`marks-${q.id}`} aria-label={`Question ${q.number} marks`} type="text" inputMode="numeric" autoComplete="off" placeholder="–" value={values[q.id] ?? ''} onChange={event => update(q.id, event.target.value)} aria-invalid={Boolean(errors[q.id])} aria-describedby={`max-${q.id}${errors[q.id] ? ` error-${q.id}` : ''}`} />
          <span id={`max-${q.id}`}>/ {q.maxMarks}</span>
          <button type="button" aria-label={`Add a mark to question ${q.number}`} onClick={() => step(q.id, q.maxMarks, 1)}><Plus aria-hidden="true" weight="bold" /></button>
        </div>
        {errors[q.id] && <p className={styles.error} id={`error-${q.id}`}>{errors[q.id]}</p>}
      </li>)}</ol>
      <div className={styles.footer}>
        <button className={styles.primary} disabled={!valid || !report?.markedMaximum}>See where your marks went</button>
        <button ref={clearButton} type="button" className={styles.quiet} onClick={() => setConfirmClear(true)}>Clear marks</button>
      </div>
    </form> : report && <div className={styles.report} aria-live="polite">
      <div className={styles.resultHeading}>
        <h3 ref={reportHeading} tabIndex={-1}>{report.complete ? `${report.markedTotal} / ${paper.maxMarks} paper marks` : `${report.markedTotal} / ${report.markedMaximum} marks on marked questions`}</h3>
        {!report.complete && <p className={styles.note}>{report.unmarkedCount} questions unmarked. This is a partial report, not a paper score.</p>}
      </div>
      {report.priorities.length ? <>
        <h4 className={styles.label}>Topics to review</h4>
        <ol className={styles.topics} aria-label="Topics to review">{(showAll ? report.priorities : report.priorities.slice(0, 3)).map(topic => <TopicEvidence key={topic.topic} topic={topic} />)}</ol>
        {report.priorities.length > 3 && <button type="button" className={styles.quiet} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show top 3 only' : `Show all ${report.priorities.length} topics`}</button>}
        {top && <a className={styles.primary} href={topicPracticeHref(top.topic, paper.bankSlug)} onClick={() => trackProductEvent('past_paper_practice_click', { bank: paper.bankSlug })}>Practise {top.topic}<ArrowRight aria-hidden="true" weight="bold" /></a>}
      </> : <p>No revision priorities from the marked questions.</p>}
      {report.successfulTopics.length > 0 && <details className={styles.details}><summary>Topics with full marks</summary><ul>{report.successfulTopics.map(topic => <li key={topic.topic}>{topic.topic}: {topic.fullMarkEvidence.map(q => `Q${q.number}`).join(', ')}</li>)}</ul></details>}
      <details className={styles.details}><summary>How topics are ranked</summary><p>Topics where more questions lost marks than got full marks come first, then repeated losses, then average loss. It looks at whole questions, so it can&apos;t tell which part lost the mark.</p></details>
      <div className={styles.footer}>
        <button type="button" className={styles.quiet} onClick={() => { setShowReport(false); setShowAll(false); }}>Edit marks</button>
        <button ref={clearButton} type="button" className={styles.quiet} onClick={() => setConfirmClear(true)}>Clear marks</button>
      </div>
    </div>}
    {confirmClear && <div role="group" aria-labelledby="clear-paper-marks" className={styles.confirm} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeClear(); } }}>
      <p id="clear-paper-marks">Clear all marks for this paper?</p>
      <button ref={keepButton} type="button" className={styles.quiet} onClick={closeClear}>Keep marks</button>{' '}
      <button type="button" className={styles.danger} onClick={clear}>Yes, clear marks</button>
    </div>}
  </section>;
}
