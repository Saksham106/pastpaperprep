"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import styles from "./PastPaperReader.module.css";

export function PastPaperPdfPage({ pdf, number, title, zoom = "fit" }: { pdf: PDFDocumentProxy; number: number; title: string; zoom?: "fit" | "actual" }) {
  const slot = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ number: number; width: number; zoom: string; retry: number; status: "ready" | "error" } | null>(null);
  const status = result?.number === number && result.width === width && result.zoom === zoom && result.retry === retry ? result.status : "loading";
  useEffect(() => {
    const node = slot.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(100, node.clientWidth - 32));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    let task: RenderTask | undefined;
    // Each render owns its canvas: cancelled tasks can never write into a newer page.
    const canvas = window.document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${title}, page ${number} of ${pdf.numPages}`);
    async function draw() {
      try {
        const page = await pdf.getPage(number);
        if (disposed) return;
        const natural = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: zoom === "fit" ? Math.min(width, 820) / natural.width : 96 / 72 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(viewport.width * ratio);
        canvas.height = Math.round(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        task = page.render({ canvas, canvasContext: context, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
        if (!disposed) { slot.current?.replaceChildren(canvas); canvas.dataset.rendered = "true"; setResult({ number, width, zoom, retry, status: "ready" }); }
      } catch { if (!disposed) setResult({ number, width, zoom, retry, status: "error" }); }
    }
    void draw();
    return () => { disposed = true; task?.cancel(); };
  }, [pdf, number, title, width, zoom, retry]);
  return <div className={styles.pageArea}>
    {status === "loading" && <div className={styles.skeleton} role="status">Rendering page {number}…</div>}
    {status === "error" && <div className={styles.error} role="alert">This page could not be rendered. <button onClick={() => setRetry(value => value + 1)}>Retry page</button></div>}
    <div ref={slot} className={styles.canvasSlot} style={{ visibility: status === "ready" ? "visible" : "hidden" }} />
  </div>;
}
