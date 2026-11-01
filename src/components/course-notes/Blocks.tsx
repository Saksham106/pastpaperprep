import Link from "next/link";
import type { ReactNode } from "react";
import { renderInlineHtml } from "@/lib/course-notes/render";
import type { Block, CheckBlock, GlossaryTerm } from "@/lib/course-notes/types";
import { CalculatorSteps } from "./CalculatorSteps";
import { CheckQuestion } from "./CheckQuestion";
import { ExampleSteps } from "./ExampleSteps";
import { FORMULA_TAG_LABEL, FormulaBlock } from "./FormulaBlock";
import { INTERACTIVES } from "./interactives/registry";
import { Inline, defaultLessonHref, type LessonHref } from "./Inline";
import styles from "./course-notes.module.css";

export type BlocksProps = {
  blocks: Block[];
  glossary: GlossaryTerm[];
  /** The student's chosen level. `AHL` is treated as HL. */
  level: "SL" | "HL" | "AHL";
  lessonHref?: LessonHref;
  /** Pre-built SVG markup keyed by figure id. */
  figures?: Record<string, string>;
};

export function Blocks({ blocks, glossary, level, lessonHref = defaultLessonHref, figures = {} }: BlocksProps) {
  const inline = (text: string) => <Inline text={text} glossary={glossary} lessonHref={lessonHref} />;
  const showHl = level === "HL" || level === "AHL";

  const check = (block: CheckBlock) => (
    <CheckQuestion
      id={block.id}
      prompt={inline(block.prompt)}
      hint={block.hint ? inline(block.hint) : undefined}
      options={block.options?.map((o) => ({ content: <span dangerouslySetInnerHTML={{ __html: renderInlineHtml(o.text) }} />, correct: o.correct }))}
      answer={block.answer}
      explain={inline(block.explain)}
    />
  );

  const render = (block: Block): ReactNode => {
    switch (block.type) {
      case "text":
        return <p>{inline(block.text)}</p>;
      case "definition":
        return (
          <aside className={styles.definition}>
            <b>{inline(block.term)}</b>
            <p>{inline(block.statement)}</p>
            <p className={styles.plain}>
              <span>In plain words</span> {inline(block.plain)}
            </p>
          </aside>
        );
      case "formula":
        return <FormulaBlock tex={block.tex} tag={block.tag} />;
      case "result":
        return (
          <aside className={`${styles.side} ${styles.sideNote}`}>
            <b>Result</b>
            <p>{inline(block.statement)}</p>
            <p className={styles.why}>
              <span>Why</span> {inline(block.why)}
            </p>
          </aside>
        );
      case "example":
        return (
          <ExampleSteps
            id={block.id}
            question={inline(block.question)}
            steps={block.steps.map((s) => inline(s))}
            answer={inline(block.answer)}
            check={block.check ? check(block.check) : undefined}
          />
        );
      case "check":
        return check(block);
      case "figure":
        return (
          <figure className={styles.figure}>
            <div role="img" aria-label={block.alt} {...(figures[block.id] ? { dangerouslySetInnerHTML: { __html: figures[block.id] } } : { children: block.alt })} />
            {block.caption ? <figcaption>{inline(block.caption)}</figcaption> : null}
          </figure>
        );
      case "interactive": {
        const Widget = INTERACTIVES[block.widget] ?? null;
        if (Widget) return <Widget alt={block.alt} props={block.props} />;
        return (
          <div className={styles.interactive} data-widget={block.widget} data-props={JSON.stringify(block.props)}>
            <p className={styles.small}>{block.alt}</p>
          </div>
        );
      }
      case "calculator":
        return (
          <CalculatorSteps
            steps={{
              ti84: block.steps.ti84.map((s) => inline(s)),
              nspire: block.steps.nspire.map((s) => inline(s)),
              casio: block.steps.casio.map((s) => inline(s)),
            }}
          />
        );
      case "hlNote":
        if (!showHl) return null;
        return (
          <aside className={`${styles.side} ${styles.sideHl}`} data-hl-note>
            <b>HL only</b>
            <p>
              {inline(block.text)} <Link href={lessonHref(block.lesson)}>Learn it in {block.lesson} →</Link>
            </p>
          </aside>
        );
      case "examTip":
        return (
          <aside className={`${styles.side} ${styles.sideTip}`}>
            <b>Exam tip</b>
            <p>{inline(block.text)}</p>
          </aside>
        );
      case "mistake":
        return (
          <aside className={`${styles.side} ${styles.sideMistake}`}>
            <b>Common mistake</b>
            <p>{inline(block.text)}</p>
          </aside>
        );
      case "fact":
        return (
          <aside className={`${styles.side} ${styles.sideNote}`}>
            <span className={`${styles.fTag} ${block.tag === "booklet" ? styles.fTagBooklet : styles.fTagLearn}`}>{FORMULA_TAG_LABEL[block.tag]}</span>
            <p>{inline(block.text)}</p>
          </aside>
        );
    }
  };

  return (
    <>
      {blocks.map((block, i) => {
        const node = render(block);
        return node === null ? null : <div key={i} className={styles.block}>{node}</div>;
      })}
    </>
  );
}
