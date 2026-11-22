// Worked-answer maths as HTML strings. Imports KaTeX, so browser code loads this module on demand only.
import katex from "katex";
import { splitInlineMath, textHtml } from "@/lib/explanation-text";

const KATEX = { throwOnError: false, strict: "ignore", trust: false, maxExpand: 1000, output: "htmlAndMathml" } as const;

/** Plain text with inline `$...$` maths. Text is escaped; maths goes through KaTeX. */
export function renderInlineMath(text: string): string {
  const segments = splitInlineMath(text);
  if (segments.length % 2 === 0) return textHtml(text);
  return segments.map((segment, index) => index % 2 ? katex.renderToString(segment, KATEX) : textHtml(segment)).join("");
}

export function renderDisplayMath(tex: string): string {
  return katex.renderToString(tex, { ...KATEX, displayMode: true });
}
