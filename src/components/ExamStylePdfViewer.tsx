"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

/** Render pages ourselves rather than embedding Chrome's PDF plugin and its download toolbar. */
export function ExamStylePdfViewer({ src, title }: { src: string; title: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);

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

  return (
    <div ref={scrollRef} className="exam-style-pdf-pages" role="region" aria-label={`${title} practice PDF`} tabIndex={0}>
      {error ? <p className="exam-style-pdf-status" role="alert">This practice set could not be loaded. Please refresh and try again.</p> :
        document ? Array.from({ length: document.numPages }, (_, index) => (
          <PdfPage key={`${src}-${index}`} pdf={document} number={index + 1} scrollRoot={scrollRef} />
        )) : <p className="exam-style-pdf-status" role="status">Loading practice set…</p>}
    </div>
  );
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
