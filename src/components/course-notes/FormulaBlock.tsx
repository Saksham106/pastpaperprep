import { renderTex } from "@/lib/course-notes/render";
import type { FormulaTag } from "@/lib/course-notes/types";
import styles from "./course-notes.module.css";

export const FORMULA_TAG_LABEL: Record<FormulaTag, string> = { booklet: "In the formula booklet", learn: "Learn this" };

export function FormulaBlock({ tex, tag }: { tex: string; tag: FormulaTag }) {
  return (
    <div className={styles.formula}>
      <span className={`${styles.fTag} ${tag === "booklet" ? styles.fTagBooklet : styles.fTagLearn}`}>{FORMULA_TAG_LABEL[tag]}</span>
      <div dangerouslySetInnerHTML={{ __html: renderTex(tex, true) }} />
    </div>
  );
}
