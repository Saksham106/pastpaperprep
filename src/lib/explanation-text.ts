// Client-safe and KaTeX-free: the escaping half of the worked-answer maths renderer (explanation-math.ts has KaTeX).

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char]);

/** Escaped text; `\$` is a literal dollar. */
export const textHtml = (text: string) => escapeHtml(text).replace(/\\\$/g, "$");

/** Text split on unescaped `$`: odd indexes are maths, but only when the dollars pair up (an odd count of pieces). */
export const splitInlineMath = (text: string) => text.split(/(?<!\\)\$/);

/** The HTML for text that holds no inline maths, or null when it needs KaTeX. Same output as `renderInlineMath`. */
export function plainInlineHtml(text: string): string | null {
  const pieces = splitInlineMath(text).length;
  return pieces === 1 || pieces % 2 === 0 ? textHtml(text) : null;
}
