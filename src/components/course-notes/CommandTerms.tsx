import "katex/dist/katex.min.css";
import Link from "next/link";
import type { Course } from "@/lib/course-notes/course";
import { renderInlineHtml } from "@/lib/course-notes/render";
import styles from "./cheatsheet.module.css";

export function CommandTerms({ course }: { course: Course }) {
  const terms = [...course.commandTerms].sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
  return (
    <div className={`${styles.list} shell`}>
      <div className={styles.crumbs}><Link href={`/revision-notes/${course.slug}`}>IB Maths AA notes</Link> › Command terms</div>
      <h1>Command terms</h1>
      <p className={styles.lede}>The word at the start of an exam question tells you how much to write.</p>
      {terms.length === 0 ? (
        <p className={styles.empty} data-empty>Command terms are coming soon.</p>
      ) : (
        <dl>
          {terms.map((entry) => (
            <div key={entry.id} id={entry.id} className={styles.entry} data-term={entry.id}>
              <dt>{entry.term}</dt>
              <dd dangerouslySetInnerHTML={{ __html: renderInlineHtml(entry.definition) }} />
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
