"use client";

import "katex/dist/katex.min.css";
import { Fragment } from "react";
import { ExplanationMath } from "@/components/ExplanationMath";
import styles from "./helper.module.css";

/** One line of text: **bold** spans, the rest with inline $maths$. */
function Inline({ text }: { text: string }) {
  const pieces = text.split(/\*\*(.+?)\*\*/g);
  return <>{pieces.map((piece, index) => piece
    ? index % 2 ? <strong key={index}><ExplanationMath text={piece} /></strong> : <ExplanationMath key={index} text={piece} />
    : null)}</>;
}

type Block = { kind: "p" | "math"; text: string } | { kind: "ul" | "ol"; items: string[] };

/** A small, safe subset of Markdown: paragraphs, bullet and numbered lists, $$display maths$$. No HTML. */
export function parseHelperText(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("$$")) {
      flush();
      // Display maths may span lines until the closing $$.
      let tex = line.slice(2);
      while (!tex.trimEnd().endsWith("$$") && index + 1 < lines.length) tex += `\n${lines[++index]}`;
      blocks.push({ kind: "math", text: tex.trimEnd().replace(/\$\$$/, "").trim() });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d{1,2}[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flush();
      const kind = bullet ? "ul" : "ol";
      const previous = blocks[blocks.length - 1];
      const item = (bullet ?? numbered)![1];
      if (previous && previous.kind === kind) previous.items.push(item);
      else blocks.push({ kind, items: [item] });
      continue;
    }
    if (heading) { flush(); blocks.push({ kind: "p", text: `**${heading[1].replace(/\*\*/g, "")}**` }); continue; }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

export function HelperMessage({ text }: { text: string }) {
  return <div className={styles.reply}>{parseHelperText(text).map((block, index) => <Fragment key={index}>
    {block.kind === "p" && <p><Inline text={block.text} /></p>}
    {block.kind === "math" && <ExplanationMath className={styles.display} tex={block.text} />}
    {block.kind === "ul" && <ul>{block.items.map((item, itemIndex) => <li key={itemIndex}><Inline text={item} /></li>)}</ul>}
    {block.kind === "ol" && <ol>{block.items.map((item, itemIndex) => <li key={itemIndex}><Inline text={item} /></li>)}</ol>}
  </Fragment>)}</div>;
}
