import Link from "next/link";
import type { ReactNode } from "react";
import { renderInlineHtml } from "@/lib/course-notes/render";
import { calculatorSteps } from "@/lib/course-notes/calculators";
import type { Block, CalculatorSnippets, CheckBlock, GlossaryTerm } from "@/lib/course-notes/types";
import { CalculatorSteps } from "./CalculatorSteps";
import { CheckQuestion } from "./CheckQuestion";
import { ExampleSteps } from "./ExampleSteps";
import { FORMULA_TAG_LABEL, FormulaBlock } from "./FormulaBlock";
import { INTERACTIVES } from "./interactives/registry";
import { Inline, type LessonHref } from "./Inline";
import styles from "./course-notes.module.css";

export type BlocksProps = {
  blocks: Block[];
  glossary: GlossaryTerm[];
  lessonHref: LessonHref;
  /** Pre-built SVG markup keyed by figure id. */
  figures?: Record<string, string>;
  /** Heading of an `hlNote` block: the course's extension-only label (AA: "HL only"). */
  extensionOnly?: string;
  /** The course's calculator.json snippets, for calculator blocks that name one. */
  calculatorSnippets?: CalculatorSnippets;
  /**
   * The extension level (0580: "Extended") when these blocks sit in base content: a block at that level is marked
   * `data-ext` (hidden in the base view) and tagged with `extensionOnly`. Omitted inside extension content.
   */
  markLevel?: string;
};

export function Blocks({ blocks, glossary, lessonHref, figures = {}, extensionOnly = "HL only", calculatorSnippets, markLevel }: BlocksProps) {
  const inline = (text: string, key?: string | number) => <Inline key={key} text={text} glossary={glossary} lessonHref={lessonHref} />;

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
              <span className={styles.plainLabel}>In plain words</span> {inline(block.plain)}
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
              <span className={styles.whyLabel}>Why</span> {inline(block.why)}
            </p>
          </aside>
        );
      case "example":
        return (
          <ExampleSteps
            id={block.id}
            question={inline(block.question)}
            steps={block.steps.map((s, i) => inline(s, i))}
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
      case "calculator": {
        const steps = calculatorSteps(block, calculatorSnippets);
        if (!steps) return null;
        return <CalculatorSteps steps={Object.fromEntries(Object.entries(steps).map(([id, list]) => [id, list.map((s, i) => inline(s, i))]))} />;
      }
      case "hlNote":
        return (
          <aside className={`${styles.side} ${styles.sideHl}`} data-hl-note>
            <b>{extensionOnly}</b>
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
        if (node === null) return null;
        if (markLevel && "level" in block && block.level === markLevel) {
          return (
            <div key={i} className={styles.block} data-ext="">
              <span className={styles.extTag}>{extensionOnly}</span>
              {node}
            </div>
          );
        }
        return <div key={i} className={styles.block}>{node}</div>;
      })}
    </>
  );
}
