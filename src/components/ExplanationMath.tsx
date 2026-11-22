"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { plainInlineHtml } from "@/lib/explanation-text";

/*
 * Worked-answer maths sent to the browser as its TeX source, not as rendered KaTeX markup (the course-notes MathHtml
 * approach, with the worked-answer renderer so the HTML stays byte-identical).
 *
 * Rendered KaTeX is ~30x its TeX, and a prerendered page stores its RSC payload four times (inline in the HTML, .rsc
 * and two segment files), all of them read from the ISR cache on every visit. So the server renders KaTeX into the HTML
 * only and the payload carries the source. Hydrating keeps the server's markup as is (no KaTeX in the browser); KaTeX
 * loads only for maths mounted without server markup, such as after a client-side navigation. If it can't be loaded,
 * that maths shows its source (never a blank) until a later mount loads it.
 */

type Renderer = typeof import("@/lib/explanation-math");
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
    return await import("@/lib/explanation-math");
  } catch (error) {
    if (attempt >= RETRY_DELAYS_MS.length) throw error;
    await wait(RETRY_DELAYS_MS[attempt]);
    return importRenderer(attempt + 1);
  }
}

/** KaTeX in its own chunk; up to three attempts per load, and the next call after a failed load tries again. */
export function loadRenderer(): Promise<Renderer> {
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

// On the server, start loading with the module so renders rarely have to wait for it.
if (typeof window === "undefined") void loadRenderer().catch(() => {});

/** Inline text with `$...$` maths in a span, or one display formula in a div. */
type Props = { className?: string } & ({ text: string; tex?: never } | { tex: string; text?: never });

const EMPTY = { __html: "" };
const FALLBACK_TITLE = "Maths didn't load. Reload the page to show it.";

export function ExplanationMath({ className, text, tex }: Props) {
  const Tag = tex === undefined ? "span" : "div";
  const ref = useRef<HTMLDivElement & HTMLSpanElement>(null);
  // Text without maths needs no KaTeX anywhere.
  const plain = text === undefined ? null : plainInlineHtml(text);
  // On the server wait for KaTeX: the maths must be in the HTML.
  const serverRenderer = typeof window === "undefined" && plain === null ? use(loadRenderer()) : undefined;
  // In the browser: KaTeX if it has already loaded. While it hasn't, render nothing new, so hydration keeps the server's maths.
  const [renderer, setRenderer] = useState(() => serverRenderer ?? loaded);
  const [unavailable, setUnavailable] = useState(false);
  const source = tex === undefined ? `t${text}` : `d${tex}`;
  const [firstSource] = useState(source);
  // Whether the element kept the server's markup for `firstSource` (set by the first effect).
  const hydrated = useRef<boolean | undefined>(undefined);

  // A fresh object only when there is new markup: React rewrites innerHTML whenever this object changes.
  const html = useMemo(() => {
    if (plain !== null) return { __html: plain };
    if (!renderer) return EMPTY;
    return { __html: tex === undefined ? renderer.renderInlineMath(text ?? "") : renderer.renderDisplayMath(tex) };
  }, [plain, renderer, text, tex]);

  useEffect(() => {
    if (plain !== null || renderer) return;
    if (source === firstSource) {
      hydrated.current ??= Boolean(ref.current?.hasChildNodes());
      // Hydrated: the element still shows the server's markup for this source. Nothing to do.
      if (hydrated.current) return;
    }
    // Mounted in the browser before KaTeX loaded, or the source changed: render once KaTeX is here, and show the
    // source meanwhile if loading fails. Stays subscribed, so a later successful load still renders this.
    const update = () => {
      if (loaded) setRenderer(loaded);
      else setUnavailable(failed);
    };
    listeners.add(update);
    if (failed) queueMicrotask(update);
    loadRenderer().catch(() => {});
    return () => void listeners.delete(update);
  }, [plain, renderer, source, firstSource]);

  if (plain === null && !renderer && unavailable) {
    return <Tag ref={ref} className={className} data-tex-fallback="" title={FALLBACK_TITLE}>{tex ?? text}</Tag>;
  }
  return <Tag ref={ref} className={className} suppressHydrationWarning dangerouslySetInnerHTML={html} />;
}
