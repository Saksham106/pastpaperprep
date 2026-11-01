import "server-only";
import katex from "katex";
import { parseInline } from "./inline";

/** Server-only KaTeX rendering. Throws on invalid TeX so a bad lesson fails the build, not the student. */
export function renderTex(tex: string, display: boolean): string {
  return katex.renderToString(tex, { output: "htmlAndMathml", throwOnError: true, displayMode: display });
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (c) => ESCAPES[c]);

export type RenderInlineOptions = {
  /** When given, `{{lesson:x}}` becomes a link; otherwise it is plain text. */
  lessonHref?: (item: string) => string;
};

/**
 * Flat HTML for inline text that must live inside a client island (for example a glossary definition).
 * Glossary terms collapse to their label here; nested pop-ups are not supported.
 */
export function renderInlineHtml(text: string, opts: RenderInlineOptions = {}): string {
  return parseInline(text)
    .map((node) => {
      switch (node.kind) {
        case "text":
          return escapeHtml(node.value);
        case "math":
          return renderTex(node.tex, false);
        case "term":
          return escapeHtml(node.label);
        case "lesson":
          return opts.lessonHref ? `<a href="${escapeHtml(opts.lessonHref(node.item))}">${escapeHtml(node.item)}</a>` : escapeHtml(node.item);
      }
    })
    .join("");
}
