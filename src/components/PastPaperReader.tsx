"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PaperAttemptTimer } from "./PaperAttemptTimer";
import { PastPaperPdfPage } from "./PastPaperPdfPage";
import styles from "./PastPaperReader.module.css";

export type { PaperReaderConfig } from "../lib/paper-reader-config";
import { DEFAULT_PAPER_READER_CONFIG, type PaperReaderConfig } from "../lib/paper-reader-config";

export function PastPaperReader({ paper = DEFAULT_PAPER_READER_CONFIG }: { paper?: PaperReaderConfig }) {
  return <PastPaperReaderSession key={paper.id} paper={paper} />;
}

function PastPaperReaderSession({ paper }: { paper: PaperReaderConfig }) {
  const hours = paper.durationMinutes === null ? 0 : Math.floor(paper.durationMinutes / 60);
  const minutes = paper.durationMinutes === null ? 0 : paper.durationMinutes % 60;
  const duration = paper.durationMinutes === null ? 'Duration unverified' : [hours ? `${hours} hour${hours === 1 ? "" : "s"}` : "", minutes ? `${minutes} minute${minutes === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
  const componentLabel = `${paper.component}${paper.variant ? (/^\d$/.test(paper.variant) && paper.qualification === 'Cambridge IGCSE' ? paper.variant : ` · ${paper.variant}`) : ''}`;
  const [focused, setFocused] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const focusButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const wasFocused = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!focused) {
      if (dialog.open) dialog.close();
      dialog.setAttribute("open", "");
      if (wasFocused.current) focusButton.current?.focus();
      wasFocused.current = false;
      return;
    }
    wasFocused.current = true;
    dialog.close(); dialog.showModal(); exitButton.current?.focus();
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => { window.document.body.style.overflow = previous; };
  }, [focused]);
  const [loaded, setLoaded] = useState<{ src: string; retry: number; pdf: PDFDocumentProxy | null; error: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const [kind, setKind] = useState<"question" | "markscheme">("question");
  const title = kind === "question" ? "Question paper" : "Mark scheme";
  const src = paper.sources[kind];
  const current = loaded?.src === src && loaded.retry === retry ? loaded : null;
  const pdf = current?.pdf ?? null;
  const error = current?.error ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef({ question: 0, markscheme: 0 });
  const scrollAnchors = useRef({ question: { page: 1, fraction: 0 }, markscheme: { page: 1, fraction: 0 } });
  const [mode, setMode] = useState<"scroll" | "single">("scroll");
  const [zoom, setZoom] = useState<"fit" | "actual">("fit");
  const [positions, setPositions] = useState({ question: 1, markscheme: 1 });
  const [editing, setEditing] = useState({ kind, page: 1, value: "1" });
  const pageNumber = Math.min(positions[kind], pdf?.numPages || positions[kind]);
  const draft = editing.kind === kind && editing.page === pageNumber ? editing.value : String(pageNumber);
  function selectDocument(next: "question" | "markscheme") {
    if (next !== kind) { setKind(next); setRetry(value => value + 1); }
  }
  function goTo(value: number) {
    const next = Math.max(1, Math.min(pdf?.numPages || 1, Number.isFinite(value) ? Math.trunc(value) : pageNumber));
    scrollAnchors.current[kind] = { page: next, fraction: 0 };
    if (mode === "scroll" && stageRef.current) {
      const target = stageRef.current.querySelector<HTMLElement>(`[data-paper-page="${next}"]`);
      if (target) { stageRef.current.scrollTop = target.offsetTop; scrollPositions.current[kind] = target.offsetTop; }
    } else if (stageRef.current) stageRef.current.scrollTop = 0;
    setPositions(previous => ({ ...previous, [kind]: next })); setEditing({ kind, page: next, value: String(next) });
  }
  useEffect(() => {
    let disposed = false;
    let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch(src, { signal: abort.signal, credentials: "same-origin" });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("PDF unavailable");
        const data = new Uint8Array(await response.arrayBuffer());
        if (disposed) return;
        const pdfjs = await import("pdfjs-dist");
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        task = pdfjs.getDocument({ data });
        const document = await task.promise;
        if (!disposed) setLoaded({ src, retry, pdf: document, error: false });
      } catch { if (!disposed) setLoaded({ src, retry, pdf: null, error: true }); }
    }
    void load();
    return () => { disposed = true; abort.abort(); void task?.destroy(); };
  }, [src, retry]);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !pdf) return;
    const anchor = scrollAnchors.current[kind];
    const target = stage.querySelector<HTMLElement>(`[data-paper-page="${anchor.page}"]`);
    stage.scrollTop = mode === "scroll" ? target && target.offsetHeight > 0 ? target.offsetTop + anchor.fraction * target.offsetHeight : scrollPositions.current[kind] : 0;
  }, [pdf, kind, mode, focused, zoom]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !pdf || mode !== "scroll" || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<Element, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.set(entry.target, entry); else visible.delete(entry.target);
      }
      const nearest = [...visible.values()].sort((a, b) => b.intersectionRect.height - a.intersectionRect.height)[0];
      const number = Number((nearest?.target as HTMLElement | undefined)?.dataset.paperPage);
      if (number) setPositions(previous => previous[kind] === number ? previous : { ...previous, [kind]: number });
    }, { root: stage, threshold: [0, .1, .25, .5, .75, 1] });
    stage.querySelectorAll("[data-paper-page]").forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [pdf, kind, mode]);
  return <article className={styles.reader}>
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/">Home</Link><span aria-hidden="true">/</span>{paper.archiveHref ? <Link href={paper.archiveHref}>Past papers</Link> : <span>Past papers</span>}<span aria-hidden="true">/</span><span>{paper.qualification}</span></nav>
    <header className={styles.header}>
      <p className={styles.eyebrow}>{paper.qualification} <span>{paper.syllabusCode}</span></p>
      <h1>{paper.subject}</h1>
      <div className={styles.identity}><strong>{paper.sessionLabel}</strong><span>Paper {componentLabel}</span><span className={styles.paperName}>{paper.paperName}</span></div>
    </header>
    <div className={styles.layout}>
      <dialog ref={dialogRef} open aria-label={focused ? `${paper.title} · Focus view` : "Paper reader"} aria-modal={focused ? true : undefined} className={`${styles.viewer} ${focused ? styles.focused : ""}`} onCancel={event => { event.preventDefault(); setFocused(false); }} onKeyDown={event => { if (event.key === "Escape" && focused) { event.preventDefault(); setFocused(false); } }}>
        {focused && <div className={styles.focusHeading}><span>{paper.subject} · Paper {componentLabel}</span><button type="button" ref={exitButton} onClick={() => setFocused(false)}>Exit focus view</button></div>}
        <div className={styles.documentHeading}><div role="tablist" aria-label="Document">{(["question", "markscheme"] as const).map(type => <button key={type} id={`paper-tab-${type}`} role="tab" aria-selected={kind === type} aria-controls="paper-panel" tabIndex={kind === type ? 0 : -1} onClick={() => selectDocument(type)} onKeyDown={event => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault(); const next = event.key === "Home" ? "question" : event.key === "End" ? "markscheme" : type === "question" ? "markscheme" : "question";
            selectDocument(next); window.document.getElementById(`paper-tab-${next}`)?.focus();
          }
        }}>{type === "question" ? "Question paper" : "Mark scheme"}</button>)}</div><button className={styles.focusButton} type="button" ref={focusButton} hidden={focused} onClick={() => setFocused(true)}>Focus view <span aria-hidden="true">↗</span></button></div>
        {paper.durationMinutes !== null && <PaperAttemptTimer durationMinutes={paper.durationMinutes} />}
        <div className={styles.toolbar} aria-label="Page controls"><div className={styles.pagination}>
          <button type="button" aria-label="Previous page" disabled={!pdf || pageNumber === 1} onClick={() => goTo(pageNumber - 1)}>←</button>
          <label>Page <input aria-label="Page number" type="number" inputMode="numeric" min={1} max={pdf?.numPages || 1} disabled={!pdf} value={draft} onChange={event => setEditing({ kind, page: pageNumber, value: event.target.value })} onBlur={() => goTo(Number(draft))} onKeyDown={event => { if (event.key === "Enter") goTo(Number(draft)); }} /></label><span>of {pdf?.numPages ?? "…"}</span>
          <button type="button" aria-label="Next page" disabled={!pdf || pageNumber === pdf.numPages} onClick={() => goTo(pageNumber + 1)}>→</button>
        </div><div className={styles.viewControls}><select className={styles.zoom} aria-label="Reading mode" value={mode} onChange={event => setMode(event.target.value as "scroll" | "single")}><option value="scroll">Scroll pages</option><option value="single">Single page</option></select><select className={styles.zoom} aria-label="PDF zoom" value={zoom} onChange={event => setZoom(event.target.value as "fit" | "actual")}><option value="fit">Fit width</option><option value="actual">100%</option></select></div></div>
        <div ref={stageRef} onScroll={() => {
          const stage = stageRef.current;
          if (mode !== "scroll" || !stage || !pdf) return;
          scrollPositions.current[kind] = stage.scrollTop;
          const node = [...stage.querySelectorAll<HTMLElement>("[data-paper-page]")].find(page => page.offsetHeight > 0 && page.offsetTop <= stage.scrollTop && page.offsetTop + page.offsetHeight > stage.scrollTop);
          if (node) scrollAnchors.current[kind] = { page: Number(node.dataset.paperPage), fraction: (stage.scrollTop - node.offsetTop) / node.offsetHeight };
        }} className={styles.stage} id="paper-panel" role="tabpanel" tabIndex={0} aria-labelledby={`paper-tab-${kind}`}>
          {error ? <div className={styles.error} role="alert">The PDF could not be loaded. Please try again.<button type="button" onClick={() => setRetry(value => value + 1)}>Retry PDF</button></div> : pdf ? mode === "single" ? <PastPaperPdfPage key={src} pdf={pdf} number={pageNumber} title={title} zoom={zoom} /> : <div className={`${styles.pageStack} ${zoom === "actual" ? styles.actualStack : ""}`}>{Array.from({ length: pdf.numPages }, (_, index) => index + 1).map(number => <div key={`${src}-${number}`} data-paper-page={number} className={styles.scrollPage} aria-label={`${title}, page ${number}`}>
            {Math.abs(number - pageNumber) <= 1 ? <PastPaperPdfPage pdf={pdf} number={number} title={title} zoom={zoom} /> : <span className={styles.pagePlaceholder}>Page {number}</span>}
          </div>)}</div> : <div className={styles.skeleton} role="status">Loading original PDF…</div>}
        </div>
        <div className={styles.documentNote}><span>Original PDF · {paper.qualification} examination document</span><a href={src} download={`${paper.id}_${kind === "question" ? "qp" : "ms"}.pdf`}>Download {title.toLowerCase()}</a></div>
      </dialog>
      <aside className={styles.sidebar} aria-label="Paper details">
        <section><p className={styles.eyebrow}>The examination</p><h2>Paper details</h2><dl><div><dt>Qualification</dt><dd>{paper.qualification}</dd></div><div><dt>Subject</dt><dd>{paper.subject} · {paper.syllabusCode}</dd></div><div><dt>Component</dt><dd>Paper {paper.component} · {paper.paperName}</dd></div><div><dt>Variant</dt><dd>{paper.variant}</dd></div><div><dt>Duration</dt><dd>{duration}</dd></div><div><dt>Total marks</dt><dd>{paper.maxMarks === null ? 'Marks unverified' : paper.maxMarks}</dd></div></dl></section>
        {paper.reportAvailable !== false && <section className={styles.practice}><h2>Finished the paper?</h2><p>Use the mark scheme, enter your marks and get a free revision report.</p><a href="#paper-self-marking">Mark this paper <span aria-hidden="true">↓</span></a></section>}
        <section className={styles.practice}><p className={styles.eyebrow}>A more focused next step</p><h2>Practise by topic.</h2><p>Full papers are free. Topic practice, saved sets and custom worksheets are available in paid plans.</p><a href={`https://pastpaperprep.com/banks/${encodeURIComponent(paper.bankSlug ?? 'igcse-chemistry-0620')}?free=1`}>Try topic practice <span aria-hidden="true">↗</span></a><small>Free preview available.</small></section>
      </aside>
    </div>
  </article>;
}
