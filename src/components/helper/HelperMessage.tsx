"use client";

import "katex/dist/katex.min.css";
import { Fragment } from "react";
import { ExplanationMath } from "@/components/ExplanationMath";
import { parseMarkLine } from "@/lib/helper/marking";
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
    // Marking replies list mark points as "✓ B1 ..." / "✗ M1 ...", with or without a bullet in front.
    const bullet = /^[-*•]\s+(.*)$/.exec(line) ?? /^([✓✔✗✘].*)$/.exec(line);
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

const MARK_POINT = /^([✓✔✗✘])\s*(?:\(?((?:SC|[MABC])\d{1,2})\)?[:\s—–-]*)?(.*)$/;

function ListItem({ item }: { item: string }) {
  const point = MARK_POINT.exec(item);
  if (!point) return <li><Inline text={item} /></li>;
  const earned = point[1] === "✓" || point[1] === "✔";
  return <li className={`${styles.point} ${earned ? styles.earned : styles.lost}`}>
    <span className={styles.pointMark} aria-label={earned ? "Mark earned" : "Mark lost"}>{earned ? "✓" : "✗"}</span>
    <span>{point[2] && <code className={styles.pointCode}>{point[2]}</code>}<Inline text={point[3]} /></span>
  </li>;
}

function Paragraph({ text }: { text: string }) {
  const fix = /^\**(?:Fix|To fix|Next time)\**:\**\s*(.*)$/i.exec(text);
  if (fix) return <p className={styles.fix}><span className={styles.fixLabel}>Fix</span><Inline text={fix[1]} /></p>;
  return <p><Inline text={text} /></p>;
}

/** The score line a marking reply starts with, drawn as an examiner's mark. */
function Score({ score, total, celebrate }: { score: number; total: number; celebrate: boolean }) {
  const tone = score >= total ? styles.scoreFull : score > 0 ? styles.scorePart : styles.scoreNone;
  return <div className={`${styles.score} ${tone}`} role="img" aria-label={`Marked ${score} out of ${total}`}>
    <span className={styles.scoreNumber}>{score}</span><span className={styles.scoreTotal}>/ {total}</span>
    <span className={styles.stamp}>Marked</span>
    {/* Full marks on a marking reply that has just finished: a small burst of confetti from the stamp. */}
    {celebrate && score >= total && <span className={styles.burst} aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</span>}
  </div>;
}

/** A reply that opens with a score line ("Mark: 3 / 10"); until that line is finished it may be a misleading prefix. */
const SCORE_START = /^\s*\**\s*Mark\b/i;

/**
 * One reply. `complete` is false while it is still streaming: the score is shown only once its line has ended (so
 * "Mark: 1 / 1" is never read off a streaming "Mark: 1 / 10"). `celebrate` marks a marking reply that has just finished.
 */
export function HelperMessage({ text, complete = true, celebrate = false }: { text: string; complete?: boolean; celebrate?: boolean }) {
  const scoreLineDone = complete || text.includes("\n");
  if (!scoreLineDone && SCORE_START.test(text)) return <div className={styles.reply} />;
  const mark = parseMarkLine(text);
  const body = mark ? text.replace(/^\s*[^\n]*\n?/, "") : text;
  return <div className={styles.reply}>
    {mark && <Score score={mark.score} total={mark.total} celebrate={celebrate && complete} />}
    {parseHelperText(body).map((block, index) => <Fragment key={index}>
      {block.kind === "p" && <Paragraph text={block.text} />}
      {block.kind === "math" && <ExplanationMath className={styles.display} tex={block.text} />}
      {block.kind === "ul" && <ul>{block.items.map((item, itemIndex) => <ListItem key={itemIndex} item={item} />)}</ul>}
      {block.kind === "ol" && <ol>{block.items.map((item, itemIndex) => <ListItem key={itemIndex} item={item} />)}</ol>}
    </Fragment>)}
  </div>;
}
