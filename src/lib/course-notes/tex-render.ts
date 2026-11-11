import katex from "katex";
// mhchem registers \ce and \pu (chemical equations and units) on the katex instance above.
import "katex/contrib/mhchem";
import { parseInline } from "./inline";

// KaTeX with mhchem, shared by the server (render.ts) and the browser (MathHtml loads it lazily).

/** Throws on invalid TeX, so a bad lesson fails the build, not the student. */
export function renderTex(tex: string, display: boolean): string {
  return katex.renderToString(tex, { output: "htmlAndMathml", throwOnError: true, displayMode: display });
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (c) => ESCAPES[c]);

/**
 * Flat HTML for inline text: `$tex$` rendered, glossary terms collapsed to their label, and `{{lesson:x}}` a link when
 * `links` has an href for it (plain text otherwise).
 */
export function renderInlineHtml(text: string, links?: Readonly<Record<string, string>>): string {
  return parseInline(text)
    .map((node) => {
      switch (node.kind) {
        case "text":
          return escapeHtml(node.value);
        case "math":
          return renderTex(node.tex, false);
        case "term":
          return escapeHtml(node.label);
        case "lesson": {
          const href = links?.[node.item];
          return href === undefined ? escapeHtml(node.item) : `<a href="${escapeHtml(href)}">${escapeHtml(node.item)}</a>`;
        }
      }
    })
    .join("");
}
