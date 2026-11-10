import "server-only";
import { lessonLinks } from "./inline";
import { renderInlineHtml as inlineHtml } from "./tex-render";

/** Server-only KaTeX rendering, with mhchem. Throws on invalid TeX so a bad lesson fails the build, not the student. */
export { renderTex } from "./tex-render";

export type RenderInlineOptions = {
  /** When given, `{{lesson:x}}` becomes a link; otherwise it is plain text. */
  lessonHref?: (item: string) => string;
};

/** Flat HTML for inline text. Glossary terms collapse to their label here; nested pop-ups are not supported. */
export function renderInlineHtml(text: string, opts: RenderInlineOptions = {}): string {
  return inlineHtml(text, opts.lessonHref ? lessonLinks(text, opts.lessonHref) : undefined);
}
