"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowsOut, ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

/** Render pages ourselves rather than embedding Chrome's PDF plugin and its download toolbar. */
export function ExamStylePdfViewer({ src, title, eyebrow, headingId }: { src: string; title: string; eyebrow: string; headingId: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const wasFocusedRef = useRef(false);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      if (wasFocusedRef.current) expandRef.current?.focus();
      wasFocusedRef.current = false;
      return;
    }
    wasFocusedRef.current = true;
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => backRef.current?.focus());
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setFocused(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [backRef.current, scrollRef.current].filter((node): node is HTMLButtonElement | HTMLDivElement => node !== null);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (window.document.activeElement === first || !focusRef.current?.contains(window.document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (window.document.activeElement === last || !focusRef.current?.contains(window.document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.document.removeEventListener("keydown", handleKeyDown);
      window.document.body.style.overflow = previousOverflow;
    };
  }, [focused]);

  useEffect(() => {
    let disposed = false;
    let loadingTask: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    const controller = new AbortController();
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    async function load() {
      try {
        const response = await fetch(src, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) {
          throw new Error("PDF unavailable");
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (disposed) return;
        const pdfjs = await import("pdfjs-dist");
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        loadingTask = pdfjs.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        if (disposed) { await pdf.destroy(); return; }
        setDocument(pdf);
      } catch {
        if (!disposed) setError(true);
      }
    }
    void load();
    return () => {
      disposed = true;
      controller.abort();
      void loadingTask?.destroy();
    };
  }, [src]);

  return (<>
    <header className="exam-style-pdf-heading">
      <div><p className="eyebrow">{eyebrow}</p><h2 id={headingId}>{title}</h2></div>
      {!focused && <button ref={expandRef} className="exam-style-pdf-action" type="button" onClick={() => setFocused(true)}>
        <ArrowsOut aria-hidden="true" /> Focus view
      </button>}
    </header>
    <div ref={focusRef} className={`exam-style-pdf-shell${focused ? " is-focused" : ""}`}
      role={focused ? "dialog" : undefined} aria-modal={focused ? "true" : undefined}
      aria-label={focused ? `${title} focused practice PDF` : undefined}>
      <div className="exam-style-pdf-controls">
        {focused ? <>
          <span className="exam-style-pdf-focus-title">{title}</span>
          <button ref={backRef} className="exam-style-pdf-action" type="button" onClick={() => setFocused(false)}>
            <ArrowLeft aria-hidden="true" /> Back to practice
          </button>
        </> : null}
      </div>
      <div ref={scrollRef} className="exam-style-pdf-pages" role="region" aria-label={`${title} practice PDF`} tabIndex={0}>
        {error ? <p className="exam-style-pdf-status" role="alert">This practice set could not be loaded. Please refresh and try again.</p> :
          document ? Array.from({ length: document.numPages }, (_, index) => (
            <PdfPage key={`${src}-${index}`} pdf={document} number={index + 1} scrollRoot={scrollRef} />
          )) : <p className="exam-style-pdf-status" role="status">Loading practice set…</p>}
      </div>
    </div>
  </>);
}

function PdfPage({ pdf, number, scrollRoot }: { pdf: PDFDocumentProxy; number: number; scrollRoot: React.RefObject<HTMLDivElement | null> }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || !scrollRoot.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { root: scrollRoot.current, rootMargin: "650px 0px" });
    observer.observe(slot);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    let renderTask: RenderTask | undefined;
    let page: PDFPageProxy | undefined;
    const canvas = canvasRef.current;
    const slot = slotRef.current;
    if (!canvas || !slot) return;

    async function renderPage() {
      try {
        page = await pdf.getPage(number);
        if (disposed || !canvas || !slot) return;
        const natural = page.getViewport({ scale: 1 });
        const width = Math.min(slot.clientWidth - 20, 820);
        const scale = width / natural.width;
        const viewport = page.getViewport({ scale });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        renderTask = page.render({ canvas, canvasContext: context, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
        await renderTask.promise;
        if (!disposed) canvas.dataset.rendered = "true";
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        page?.cleanup();
      }
    }
    void renderPage();
    return () => { disposed = true; renderTask?.cancel(); };
  }, [pdf, number, visible]);

  return (
    <div className="exam-style-pdf-page" ref={slotRef} aria-label={`Page ${number}`}>
      <span className="exam-style-pdf-page-number">Page {number}</span>
      {failed ? <p role="alert">Page {number} could not be rendered.</p> : <canvas ref={canvasRef} aria-label={`Page ${number} of the practice set`} role="img" />}
    </div>
  );
}
