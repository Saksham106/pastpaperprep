import Link from "next/link";
import itemsJson from "@/data/aa-official-subtopics/items.json";
import { lessonPath, topicPath, type Course } from "@/lib/course-notes/course";
import { groupPracticeHref, groupQuestionCounts, practiceGroupForItem } from "@/lib/course-notes/practice";
import { renderTex } from "@/lib/course-notes/render";
import type { Lesson } from "@/lib/course-notes/types";
import { formatUpdateDate, lastUpdated } from "@/lib/updates";
import { Blocks } from "./Blocks";
import { FormulaTagLabel } from "./FormulaBlock";
import { Inline } from "./Inline";
import { LessonFooter, PractiseBand, type PracticeInfo } from "./LessonActions";
import { LessonRail, type RailSection } from "./LessonRail";
import { LessonShell } from "./LessonShell";
import styles from "./course-notes.module.css";


const ITEM_NAMES = new Map((itemsJson.items as { item: string; name: string }[]).map((entry) => [entry.item, entry.name]));

const byItem = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/** "3.14–3.18" for consecutive items in one topic, otherwise "2.8 and 2.13" (or "a, b and c"). */
export function practiseItemsLabel(items: string[]): string {
  const sorted = [...items].sort(byItem);
  if (sorted.length < 2) return sorted[0] ?? "";
  const parts = sorted.map((item) => item.split(".").map(Number));
  const consecutive = parts.every((part, i) => i === 0 || (part[0] === parts[i - 1][0] && part[1] === parts[i - 1][1] + 1));
  if (consecutive) return `${sorted[0]}–${sorted[sorted.length - 1]}`;
  return `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

function practiceFor(item: string): PracticeInfo | undefined {
  const group = practiceGroupForItem(item);
  if (!group) return undefined;
  return {
    group: group.id,
    items: practiseItemsLabel(group.memberOfficialItems),
    counts: groupQuestionCounts(group.id),
    hrefs: { SL: groupPracticeHref(group.id, "SL"), HL: groupPracticeHref(group.id, "HL") },
  };
}

export function LessonPage({ course, lesson }: { course: Course; lesson: Lesson }) {
  const written = new Map(course.lessons.map((entry) => [entry.item, entry]));
  const lessonHref = (item: string) => {
    const target = written.get(item);
    return target ? lessonPath(course, target) : `/revision-notes/${course.slug}`;
  };
  const inline = (text: string) => <Inline text={text} glossary={course.glossary} lessonHref={lessonHref} />;
  const topic = course.topics.find((entry) => entry.n === lesson.topic);
  const path = lessonPath(course, lesson);
  const reviewed = lastUpdated([path]);
  const practice = practiceFor(lesson.item);

  // A section made only of takeaway blocks is the authored "Key takeaways": shown once, in its own band.
  const isTakeaway = (block: Lesson["sections"][number]["blocks"][number]) => block.type === "fact" || (block.type === "formula" && block.cheatSheet === true);
  const bodySections = lesson.sections.filter((section) => !(section.blocks.length > 0 && section.blocks.every(isTakeaway)));

  // The same formula can be flagged where it is taught and again in the takeaways section: show it once.
  const seen = new Set<string>();
  const takeaways = lesson.sections.flatMap((section) => section.blocks).flatMap((block) => {
    const key = block.type === "fact" ? `f:${block.text}` : block.type === "formula" ? `t:${block.tex}` : "";
    if (!key || (block.type === "formula" && !block.cheatSheet) || seen.has(key)) return [];
    seen.add(key);
    if (block.type === "fact") return [{ tag: block.tag, node: inline(block.text) }];
    if (block.type === "formula") return [{ tag: block.tag, node: <span dangerouslySetInnerHTML={{ __html: renderTex(block.tex, true) }} /> }];
    return [];
  });

  const prerequisite = (item: string) => {
    const target = written.get(item);
    const label = `${item} ${target?.title ?? ITEM_NAMES.get(item) ?? ""}`.trim();
    return target ? <Link href={lessonPath(course, target)}>{label}</Link> : <span>{label}</span>;
  };
  const prerequisiteList = lesson.prerequisites.flatMap((item, i, all) => [
    i === 0 ? null : i === all.length - 1 ? " and " : ", ",
    <span key={item}>{prerequisite(item)}</span>,
  ]);

  const sections: RailSection[] = [
    { id: "minute", title: "In a minute" },
    ...(lesson.before.length ? [{ id: "before", title: "Before you start" }] : []),
    ...bodySections.map((section) => ({ id: `s-${section.id}`, title: section.heading })),
    ...(lesson.mistakes.length ? [{ id: "mistakes", title: "Common mistakes" }] : []),
    ...(lesson.examTips.length ? [{ id: "tips", title: "Exam tips" }] : []),
    ...(takeaways.length ? [{ id: "takeaways", title: "Key takeaways" }] : []),
    ...(practice ? [{ id: "practise", title: "Practise" }] : []),
  ];

  const neighbours = course.lessons.map((entry) => ({ item: entry.item, title: entry.title, href: lessonPath(course, entry), level: entry.level }));

  return (
    <LessonShell topic={lesson.topic} lesson={lesson.item}>
      <div className={styles.lessonLayout}>
        <LessonRail item={lesson.item} sections={sections} />
        <article className={styles.lesson}>
          <header className={styles.lHead}>
            <div className={styles.crumbs}>
              <Link href={`/revision-notes/${course.slug}`}>IB Maths AA notes</Link>
              {topic ? <> › <Link href={topicPath(course, topic.n)}>{topic.n} {topic.name}</Link></> : null}
            </div>
            <div className={styles.lBadges}>
              {lesson.level === "AHL" ? (
                <span className={`${styles.badge} ${styles.badgeAhl}`}>{lesson.item} · AHL · HL only</span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeSl}`}>{lesson.item} · SL</span>
              )}
              {lesson.papers.map((paper) => <span key={paper} className={styles.paper}>Paper {paper.slice(1)}</span>)}
            </div>
            <h1>{lesson.title}</h1>
            <div className={styles.lMeta}>
              {lesson.prerequisites.length ? <span>Builds on {prerequisiteList}</span> : null}
              <span>{lesson.readingMinutes} min read</span>
              {reviewed ? <span>Last reviewed {formatUpdateDate(reviewed)}</span> : null}
            </div>
          </header>

          <section id="minute" className={styles.minute}>
            <h2 className={styles.srOnly}>In a minute</h2>
            <p>{inline(lesson.summary)}</p>
          </section>

          <section className={styles.goals}>
            <h2>You&apos;ll be able to</h2>
            <ul>{lesson.goals.map((goal) => <li key={goal.text}>{inline(goal.text)}</li>)}</ul>
          </section>

          {lesson.before.length ? (
            <section id="before" className={styles.before}>
              <details>
                <summary><span>Before you start</span><small>{lesson.before.length} quick question{lesson.before.length === 1 ? "" : "s"} on what this builds on</small></summary>
                <div className={styles.beforeBody}>
                  <Blocks blocks={lesson.before} glossary={course.glossary} level="HL" figures={course.figures} lessonHref={lessonHref} />
                  {lesson.prerequisites.length ? <p className={styles.revise}>Revise first: {prerequisiteList}</p> : null}
                </div>
              </details>
            </section>
          ) : null}

          {bodySections.map((section) => (
            <section key={section.id} id={`s-${section.id}`}>
              <h2>{section.heading}</h2>
              <Blocks blocks={section.blocks} glossary={course.glossary} level="HL" figures={course.figures} lessonHref={lessonHref} />
            </section>
          ))}

          {lesson.mistakes.length ? (
            <section id="mistakes">
              <h2>Common mistakes</h2>
              <ul className={styles.mistakes}>{lesson.mistakes.map((text, i) => <li key={i}>{inline(text)}</li>)}</ul>
            </section>
          ) : null}

          {lesson.examTips.length ? (
            <section id="tips">
              <h2>Exam tips</h2>
              <ul className={styles.tips}>{lesson.examTips.map((text, i) => <li key={i}>{inline(text)}</li>)}</ul>
            </section>
          ) : null}

          {takeaways.length ? (
            <section id="takeaways">
              <h2>Key takeaways</h2>
              <div className={styles.tkGrid}>
                {takeaways.map((entry, i) => (
                  <div key={i}><FormulaTagLabel tag={entry.tag} short />{entry.node}</div>
                ))}
              </div>
            </section>
          ) : null}

          {practice ? <PractiseBand practice={practice} /> : null}

          <LessonFooter item={lesson.item} lessons={neighbours} />
        </article>
      </div>
    </LessonShell>
  );
}
