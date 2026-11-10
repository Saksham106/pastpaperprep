"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";

/*
 * Maths (and inline text that may hold maths) sent to the browser as its TeX source, not as rendered KaTeX markup.
 *
 * Rendered KaTeX is ~900 bytes per formula against ~20 of TeX, and a prerendered page stores its RSC payload four times
 * (inline in the HTML, .rsc and two segment files). So the server renders KaTeX into the HTML only, and the payload
 * carries the source. Hydrating keeps the server's markup as is (no KaTeX in the browser at all); KaTeX loads in the
 * background and is only used for maths mounted later, such as after a client-side navigation or in a glossary pop-up.
 */

type Renderer = typeof import("@/lib/course-notes/tex-render");
/** React reads `status`/`value` off a promise passed to `use`, so a settled one doesn't suspend. */
type TrackedPromise = Promise<Renderer> & { status?: "fulfilled"; value?: Renderer };

let loading: TrackedPromise | undefined;
let loaded: Renderer | undefined;

/** KaTeX (with mhchem), in its own chunk. Resolves once; a failed load is retried on the next call. */
export function loadTexRenderer(): Promise<Renderer> {
  if (!loading) {
    const promise: TrackedPromise = import("@/lib/course-notes/tex-render").then(
      (mod) => {
        loaded = mod;
        promise.status = "fulfilled";
        promise.value = mod;
        return mod;
      },
      (error: unknown) => {
        loading = undefined;
        throw error;
      },
    );
    loading = promise;
  }
  return loading;
}

if (typeof window !== "undefined") {
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

export function MathHtml({ as: Tag = "span", tex, display = false, text, links }: Props) {
  const ref = useRef<HTMLDivElement & HTMLSpanElement>(null); // fits any of the three tags
  // On the server (once per process) wait for KaTeX: the maths must be in the HTML.
  const serverRenderer = typeof window === "undefined" ? use(loadTexRenderer()) : undefined;
  // In the browser: KaTeX if it has already loaded. While it hasn't, render nothing new, so hydration keeps the server's maths.
  const [renderer, setRenderer] = useState(() => serverRenderer ?? loaded);
  const source = tex === undefined ? `t${text}` : `${display ? "d" : "i"}${tex}`;
  const [firstSource] = useState(source);

  // A fresh object only when there is new markup: React rewrites innerHTML whenever this object changes.
  const html = useMemo(
    () => (renderer ? { __html: tex === undefined ? renderer.renderInlineHtml(text ?? "", links) : renderer.renderTex(tex, display) } : EMPTY),
    [renderer, tex, display, text, links],
  );

  useEffect(() => {
    // Hydrated: the element still shows the server's markup for this source. Otherwise (mounted in the browser before
    // KaTeX loaded, or the source changed) load KaTeX and render.
    if (renderer || (source === firstSource && ref.current?.hasChildNodes())) return;
    let live = true;
    loadTexRenderer().then(
      (mod) => live && setRenderer(mod),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [renderer, source, firstSource]);

  return <Tag ref={ref} suppressHydrationWarning dangerouslySetInnerHTML={html} />;
}
