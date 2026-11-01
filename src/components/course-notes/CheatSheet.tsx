import "katex/dist/katex.min.css";
import Link from "next/link";
import { lessonPath, type Course } from "@/lib/course-notes/course";
import { sheetTopics, type SheetRow } from "@/lib/course-notes/cheatsheet";
import { renderInlineHtml, renderTex } from "@/lib/course-notes/render";
import { CheatSheetFrame } from "./CheatSheetFrame";
import styles from "./cheatsheet.module.css";

/** `topic` limits the sheet to one topic; omitted means the whole course. All maths is rendered here, on the server. */
export function CheatSheet({ course, topic }: { course: Course; topic?: Course["topics"][number] }) {
  const base = `/revision-notes/${course.slug}`;
  const lessonHref = (item: string) => {
    const lesson = course.lessons.find((entry) => entry.item === item);
    return lesson ? lessonPath(course, lesson) : base;
  };
  const html = (row: SheetRow) => (row.kind === "formula" ? renderTex(row.value, false) : renderInlineHtml(row.value, { lessonHref }));
  const topics = sheetTopics(course, topic);
  return (
    <CheatSheetFrame
      title={topic ? topic.name : course.name}
      slug={topic ? topic.slug : "course"}
      crumbs={[{ label: "IB Maths AA notes", href: base }, ...(topic ? [{ label: topic.name, href: `${base}/${topic.slug}` }] : [])]}
    >
      <div className={styles.cols}>
        {topics.map((entry) => (
          <section key={entry.n} className={styles.topic} data-topic={entry.n}>
            {topic ? null : <h3 className={styles.topicH}><Link href={entry.href}>{entry.n} {entry.name}</Link></h3>}
            {entry.blocks.map((block) => {
              const ahl = block.level === "AHL";
              const heading = (
                <>
                  {block.item || ahl ? <span className={styles.n}>{block.item ?? ""}{ahl ? `${block.item ? " " : ""}◆` : ""}</span> : null}
                  {block.title}
                </>
              );
              return (
                <div key={block.key} className={`${styles.blk}${ahl ? ` ${styles.ahl}` : ""}`} data-block={block.item ?? "method"} data-ahl={ahl ? "" : undefined}>
                  <h4>{block.href ? <Link href={block.href}>{heading}</Link> : heading}</h4>
                  {block.rows.map((row, i) => (
                    <div key={i} className={styles.row} data-row={row.kind}>
                      <span dangerouslySetInnerHTML={{ __html: html(row) }} />
                      <span className={`${styles.tg} ${row.tag === "booklet" ? styles.tgB : styles.tgL}`}>{row.tag === "booklet" ? "BOOKLET" : "LEARN"}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </CheatSheetFrame>
  );
}
