import Link from "next/link";
import { isExtension, lessonPath, topicPath, type Course } from "@/lib/course-notes/course";
import { lessonPractice } from "@/lib/course-notes/practice";
import { renderTex } from "@/lib/course-notes/render";
import type { Lesson } from "@/lib/course-notes/types";
import { formatUpdateDate, lastUpdated } from "@/lib/updates";
import { Blocks } from "./Blocks";
import { FormulaTagLabel } from "./FormulaBlock";
import { Inline } from "./Inline";
import { LessonFooter, PractiseBand } from "./LessonActions";
import { LessonRail, type RailSection } from "./LessonRail";
import { LessonShell } from "./LessonShell";
import styles from "./course-notes.module.css";


export function LessonPage({ course, lesson }: { course: Course; lesson: Lesson }) {
  const itemNames = new Map(course.items.items.map((entry) => [entry.item, entry.name]));
  const { levels } = course;
  const written = new Map(course.lessons.map((entry) => [entry.item, entry]));
  const lessonHref = (item: string) => {
    const target = written.get(item);
    return target ? lessonPath(course, target) : `/revision-notes/${course.slug}`;
  };
  const inline = (text: string) => <Inline text={text} glossary={course.glossary} lessonHref={lessonHref} />;
  const topic = course.topics.find((entry) => entry.n === lesson.topic);
  const path = lessonPath(course, lesson);
  const reviewed = lastUpdated([path]);
  const practice = lessonPractice(course, lesson.item);

  // Extension content inside a base lesson (0580: Extended inside Core) is marked data-ext and hidden in the base view.
  // In an extension lesson nothing is marked: the whole lesson is extension content already.
  const baseLesson = !isExtension(course, lesson.level);
  const isExt = (level: string | undefined) => baseLesson && level === levels.extension;
  const sectionExt = (section: Lesson["sections"][number]) => isExt(section.level);
  const blockExt = (section: Lesson["sections"][number], block: Lesson["sections"][number]["blocks"][number]) => isExt(("level" in block ? block.level : undefined) ?? section.level);
  const blocksProps = { glossary: course.glossary, figures: course.figures, lessonHref, extensionOnly: levels.labels.extensionOnly, calculatorSnippets: course.calculatorSnippets, markLevel: baseLesson ? levels.extension : undefined };

  // A section made only of takeaway blocks is the authored "Key takeaways": shown once, in its own band.
  const isTakeaway = (block: Lesson["sections"][number]["blocks"][number]) => block.type === "fact" || (block.type === "formula" && block.cheatSheet === true);
  const bodySections = lesson.sections.filter((section) => !(section.blocks.length > 0 && section.blocks.every(isTakeaway)));

  // The same formula can be flagged where it is taught and again in the takeaways section: show it once.
  const seen = new Set<string>();
  const takeaways = lesson.sections.flatMap((section) => section.blocks.map((block) => ({ section, block }))).flatMap(({ section, block }) => {
    const key = block.type === "fact" ? `f:${block.text}` : block.type === "formula" ? `t:${block.tex}` : "";
    if (!key || (block.type === "formula" && !block.cheatSheet) || seen.has(key)) return [];
    seen.add(key);
    const ext = blockExt(section, block);
    if (block.type === "fact") return [{ tag: block.tag, ext, node: inline(block.text) }];
    if (block.type === "formula") return [{ tag: block.tag, ext, node: <span dangerouslySetInnerHTML={{ __html: renderTex(block.tex, true) }} /> }];
    return [];
  });
  const takeawaysExt = takeaways.length > 0 && takeaways.every((entry) => entry.ext);

  const prerequisite = (item: string) => {
    const target = written.get(item);
    const label = `${item} ${target?.title ?? itemNames.get(item) ?? ""}`.trim();
    return target ? <Link href={lessonPath(course, target)}>{label}</Link> : <span>{label}</span>;
  };
  const prerequisiteList = lesson.prerequisites.flatMap((item, i, all) => [
    i === 0 ? null : i === all.length - 1 ? " and " : ", ",
    <span key={item}>{prerequisite(item)}</span>,
  ]);

  const sections: RailSection[] = [
    { id: "minute", title: "In a minute" },
    ...(lesson.before.length ? [{ id: "before", title: "Before you start" }] : []),
    ...bodySections.map((section) => ({ id: `s-${section.id}`, title: section.heading, ...(sectionExt(section) ? { ext: true } : {}) })),
    ...(lesson.mistakes.length ? [{ id: "mistakes", title: "Common mistakes" }] : []),
    ...(lesson.examTips.length ? [{ id: "tips", title: "Exam tips" }] : []),
    ...(takeaways.length ? [{ id: "takeaways", title: "Key takeaways", ...(takeawaysExt ? { ext: true } : {}) }] : []),
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
              <Link href={`/revision-notes/${course.slug}`}>{`${course.name} notes`}</Link>
              {topic ? <> › <Link href={topicPath(course, topic.n)}>{topic.n} {topic.name}</Link></> : null}
            </div>
            <div className={styles.lBadges}>
              {isExtension(course, lesson.level) ? (
                <span className={`${styles.badge} ${styles.badgeAhl}`}>{lesson.item}{` · ${levels.extension === levels.labels.extension ? "" : `${levels.extension} · `}${levels.labels.extensionOnly}`}</span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeSl}`}>{lesson.item}{` · ${levels.labels.base}`}</span>
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
            <ul>{lesson.goals.map((goal) => <li key={goal.text} data-ext={isExt(goal.level) ? "" : undefined}>{inline(goal.text)}</li>)}</ul>
          </section>

          {lesson.before.length ? (
            <section id="before" className={styles.before}>
              <details>
                <summary><span>Before you start</span><small>{lesson.before.length} quick question{lesson.before.length === 1 ? "" : "s"} on what this builds on</small></summary>
                <div className={styles.beforeBody}>
                  <Blocks blocks={lesson.before} {...blocksProps} />
                  {lesson.prerequisites.length ? <p className={styles.revise}>Revise first: {prerequisiteList}</p> : null}
                </div>
              </details>
            </section>
          ) : null}

          {bodySections.map((section) =>
            sectionExt(section) ? (
              <section key={section.id} id={`s-${section.id}`} data-ext="">
                <h2>{section.heading} <span className={`${styles.badge} ${styles.badgeAhl}`}>{levels.labels.extensionOnly}</span></h2>
                <Blocks blocks={section.blocks} {...blocksProps} markLevel={undefined} />
              </section>
            ) : (
              <section key={section.id} id={`s-${section.id}`}>
                <h2>{section.heading}</h2>
                <Blocks blocks={section.blocks} {...blocksProps} />
              </section>
            ),
          )}

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
            <section id="takeaways" data-ext={takeawaysExt ? "" : undefined}>
              <h2>Key takeaways</h2>
              <div className={styles.tkGrid}>
                {takeaways.map((entry, i) => (
                  <div key={i} data-ext={entry.ext ? "" : undefined}><FormulaTagLabel tag={entry.tag} short />{entry.node}</div>
                ))}
              </div>
            </section>
          ) : null}

          {practice ? <PractiseBand practice={practice} bankPrefix={course.copy.bankPrefix} /> : null}

          <LessonFooter item={lesson.item} lessons={neighbours} />
        </article>
      </div>
    </LessonShell>
  );
}
