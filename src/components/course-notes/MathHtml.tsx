"use client";

import { use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { parseInline } from "@/lib/course-notes/inline";

/*
 * Maths (and inline text that may hold maths) sent to the browser as its TeX source, not as rendered KaTeX markup.
 *
 * Rendered KaTeX is ~900 bytes per formula against ~20 of TeX, and a prerendered page stores its RSC payload four times
 * (inline in the HTML, .rsc and two segment files). So the server renders KaTeX into the HTML only, and the payload
 * carries the source. Hydrating keeps the server's markup as is (no KaTeX in the browser at all); KaTeX loads in the
 * background and is only used for maths mounted later, such as after a client-side navigation or in a glossary pop-up.
 * If KaTeX can't be loaded, that later maths shows its TeX source (never a blank) until a retry succeeds.
 */

type Renderer = typeof import("@/lib/course-notes/tex-render");
/** React reads `status`/`value` off a promise passed to `use`, so a settled one doesn't suspend. */
type TrackedPromise = Promise<Renderer> & { status?: "fulfilled"; value?: Renderer };

/** Waits before the 2nd and 3rd attempt of one load. */
export const RETRY_DELAYS_MS = [1000, 4000];

let loading: TrackedPromise | undefined;
let loaded: Renderer | undefined;
let failed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function importRenderer(attempt = 0): Promise<Renderer> {
  try {
    return await import("@/lib/course-notes/tex-render");
  } catch (error) {
    if (attempt >= RETRY_DELAYS_MS.length) throw error;
    await wait(RETRY_DELAYS_MS[attempt]);
    return importRenderer(attempt + 1);
  }
}

/**
 * KaTeX (with mhchem), in its own chunk. Each load makes up to three attempts; when they all fail, waiting components
 * show TeX source and the next call (a new mount, the browser coming back online or the tab regaining focus) loads again.
 */
export function loadTexRenderer(): Promise<Renderer> {
  if (!loading) {
    const promise: TrackedPromise = importRenderer().then(
      (mod) => {
        loaded = mod;
        failed = false;
        promise.status = "fulfilled";
        promise.value = mod;
        notify();
        return mod;
      },
      (error: unknown) => {
        loading = undefined;
        failed = true;
        notify();
        throw error;
      },
    );
    loading = promise;
  }
  return loading;
}

/** Calls `listener` when a load succeeds or fails. */
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

if (typeof window !== "undefined") {
  const retry = () => {
    if (failed && !loading) void loadTexRenderer().catch(() => {});
  };
  window.addEventListener("online", retry);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && retry());
  // Warm it once the page is idle, so a later navigation renders its maths straight away.
  const whenIdle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1));
  whenIdle(() => void loadTexRenderer().catch(() => {}));
}

type Props = { as?: "span" | "div" | "dd" } & (
  | { tex: string; display?: boolean; text?: never; links?: never }
  /** Inline text: `$tex$`, glossary terms as their label, `{{lesson:x}}` linked when `links` has it. */
  | { text: string; links?: Readonly<Record<string, string>>; tex?: never; display?: never }
);

const EMPTY = { __html: "" };
const FALLBACK_TITLE = "Maths didn't load. Reload the page to show it.";

/** Readable stand-in while KaTeX is unavailable: the text as written, with each formula's TeX source. */
function fallback(tex: string | undefined, text: string | undefined, links: Props["links"]): ReactNode {
  if (tex !== undefined) return <code>{tex}</code>;
  return parseInline(text ?? "").map((node, i) => {
    switch (node.kind) {
      case "text":
        return node.value;
      case "math":
        return <code key={i}>{node.tex}</code>;
      case "term":
        return node.label;
      case "lesson": {
        const href = links?.[node.item];
        return href === undefined ? node.item : <a key={i} href={href}>{node.item}</a>;
      }
    }
  });
}

export function MathHtml({ as: Tag = "span", tex, display = false, text, links }: Props) {
  const ref = useRef<HTMLDivElement & HTMLSpanElement>(null); // fits any of the three tags
  // On the server (once per process) wait for KaTeX: the maths must be in the HTML.
  const serverRenderer = typeof window === "undefined" ? use(loadTexRenderer()) : undefined;
  // In the browser: KaTeX if it has already loaded. While it hasn't, render nothing new, so hydration keeps the server's maths.
  const [renderer, setRenderer] = useState(() => serverRenderer ?? loaded);
  const [unavailable, setUnavailable] = useState(false);
  const source = tex === undefined ? `t${text}` : `${display ? "d" : "i"}${tex}`;
  const [firstSource] = useState(source);
  // Whether the element kept the server's markup for `firstSource` (set by the first effect).
  const hydrated = useRef<boolean | undefined>(undefined);

  // A fresh object only when there is new markup: React rewrites innerHTML whenever this object changes.
  const html = useMemo(
    () => (renderer ? { __html: tex === undefined ? renderer.renderInlineHtml(text ?? "", links) : renderer.renderTex(tex, display) } : EMPTY),
    [renderer, tex, display, text, links],
  );

  useEffect(() => {
    if (renderer) return;
    if (source === firstSource) {
      hydrated.current ??= Boolean(ref.current?.hasChildNodes());
      // Hydrated: the element still shows the server's markup for this source. Nothing to do.
      if (hydrated.current) return;
    }
    // Mounted in the browser before KaTeX loaded, or the source changed: render once KaTeX is here, and show the TeX
    // source meanwhile if loading fails. Stays subscribed, so a later successful load still renders this.
    const update = () => {
      if (loaded) setRenderer(loaded);
      else setUnavailable(failed);
    };
    const unsubscribe = subscribe(update);
    if (failed) queueMicrotask(update);
    loadTexRenderer().catch(() => {});
    return unsubscribe;
  }, [renderer, source, firstSource]);

  if (!renderer && unavailable) {
    return (
      <Tag ref={ref} data-tex-fallback="" title={FALLBACK_TITLE}>
        {fallback(tex, text, links)}
      </Tag>
    );
  }
  return <Tag ref={ref} suppressHydrationWarning dangerouslySetInnerHTML={html} />;
}

