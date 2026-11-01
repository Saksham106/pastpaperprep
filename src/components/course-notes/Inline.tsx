import "katex/dist/katex.min.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { parseInline } from "@/lib/course-notes/inline";
import { renderInlineHtml, renderTex } from "@/lib/course-notes/render";
import type { GlossaryTerm as Term } from "@/lib/course-notes/types";
import { GlossaryTerm } from "./GlossaryTerm";

export type LessonHref = (item: string) => string;
export const defaultLessonHref: LessonHref = (item) => `/notes/${item}`;

/** Server component: inline text with `$tex$`, `[[term|label]]` and `{{lesson:x}}` as a React tree. */
export function Inline({ text, glossary, lessonHref = defaultLessonHref }: { text: string; glossary: Term[]; lessonHref?: LessonHref }) {
  const nodes = parseInline(text);
  return (
    <>
      {nodes.map((node, i): ReactNode => {
        switch (node.kind) {
          case "text":
            return node.value;
          case "math":
            return <span key={i} dangerouslySetInnerHTML={{ __html: renderTex(node.tex, false) }} />;
          case "lesson":
            return (
              <Link key={i} href={lessonHref(node.item)}>
                {node.item}
              </Link>
            );
          case "term": {
            const term = glossary.find((t) => t.id === node.id);
            if (!term) return node.label;
            return (
              <GlossaryTerm
                key={i}
                id={term.id}
                label={node.label}
                definition={renderInlineHtml(term.definition)}
                lessonItem={term.lesson}
                lessonHref={lessonHref(term.lesson)}
              />
            );
          }
        }
      })}
    </>
  );
}
