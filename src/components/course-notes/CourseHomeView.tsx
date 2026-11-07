"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { LessonSearch, type HomeItem } from "./LessonSearch";
import { LevelSwitch, useNotesLevel } from "./LevelSwitch";
import { useCourse } from "./notes-context";
import { useNotesProgress } from "./useNotesProgress";
import styles from "./course-notes.module.css";

/** `label`: the syllabus's own name for the topic number ("Structure 1"); absent, the page says "Topic n". */
type TopicInfo = { n: number; name: string; label?: string; href: string; cheatSheetHref: string };

function Row({ entry, done, next }: { entry: HomeItem; done: boolean; next: boolean }) {
  const { levels } = useCourse();
  const cls = [entry.level === levels.extension ? styles.ahl : "", next ? styles.next : "", entry.href ? "" : styles.unwritten].filter(Boolean).join(" ");
  const inner = (
    <>
      <span className={styles.n}>{entry.item}</span>
      <span>{entry.name}</span>
      {done ? <span className={styles.tick} aria-label="Understood">✓</span> : <span />}
      {next ? <span className={styles.tag}>Next up</span> : null}
      {entry.href ? null : <span className={styles.tag}>Not written yet</span>}
    </>
  );
  return (
    <li className={cls}>
      {entry.href ? <Link href={entry.href} aria-label={`${entry.item} ${entry.name}${done ? ", understood" : ""}`}>{inner}</Link> : <div className={styles.rowStatic}>{inner}</div>}
    </li>
  );
}

export function CourseHomeView({ name, base, crumbs, guide, topics, items }: { name: string; base: string; /** After "Notes", e.g. ["IB", "Maths AA"]. */ crumbs: string[]; guide: string; topics: TopicInfo[]; items: HomeItem[] }) {
  const { levels } = useCourse();
  const labels = levels.labels;
  const [level, setLevel] = useNotesLevel();
  const shownIn = (entry: HomeItem) => level === "extension" || entry.level === levels.base;
  const { understood } = useNotesProgress();
  const [toggled, setToggled] = useState<Record<number, boolean>>({});

  const visible = items.filter(shownIn);
  const next = visible.find((entry) => entry.href && !understood.has(entry.item));
  const doneAll = visible.filter((entry) => understood.has(entry.item)).length;
  const currentTopic = next?.topic ?? topics[0]?.n;

  return (
    <div className={`${styles.home} shell`} data-view={labels[level]}>
      <div className={styles.courseTop}>
        <div className={styles.crumbs}>
          <Link href="/revision-notes">Notes</Link>{crumbs.map((crumb) => ` › ${crumb}`).join("")}
        </div>
        <div className={styles.topRow}>
          <div>
            <h1>{name} notes</h1>
            <p className={styles.meta}>{`The full course, in syllabus order. ${guide}`}</p>
          </div>
          <LevelSwitch level={level} onChange={setLevel} />
        </div>
        <div className={styles.courseTools}>
          <LessonSearch items={visible} />
          {next?.href ? (
            <Link className={styles.continue} href={next.href}>
              <span>
                <small>Continue</small>
                {next.item} {next.name}
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </div>

      <div className={styles.overall}>
        <span className={styles.track} role="progressbar" aria-label="Lessons understood" aria-valuemin={0} aria-valuemax={visible.length} aria-valuenow={doneAll}>
          <i style={{ width: `${visible.length ? (100 * doneAll) / visible.length : 0}%` }} />
        </span>
        <span>{doneAll} of {visible.length} lessons understood</span>
      </div>

      <div className={styles.topics}>
        {topics.map((topic) => {
          const all = items.filter((entry) => entry.topic === topic.n);
          const shown = all.filter(shownIn);
          const sl = all.filter((entry) => entry.level === levels.base);
          const ahl = all.filter((entry) => entry.level === levels.extension);
          const done = shown.filter((entry) => understood.has(entry.item)).length;
          const open = toggled[topic.n] ?? topic.n === currentTopic;
          const headingId = `topic-${topic.n}-heading`;
          const bodyId = `topic-${topic.n}-body`;
          return (
            <section key={topic.n} className={`${styles.topic} ${open ? styles.open : ""}`} style={{ "--tone": `var(--t${topic.n})`, "--tone-ink": `var(--t${topic.n}-ink)` } as CSSProperties} aria-labelledby={headingId}>
              <div className={styles.head}>
                <div className={styles.tn}>{topic.label ? topic.label.toUpperCase() : <>TOPIC {topic.n}</>}</div>
                <h2 id={headingId}><Link href={topic.href}>{topic.name}</Link></h2>
                <div className={styles.dots} aria-hidden="true">
                  {shown.map((entry) => (
                    <i key={entry.item} className={`${entry.level === levels.extension ? styles.ahlDot : ""} ${understood.has(entry.item) ? styles.doneDot : entry.item === next?.item ? styles.nextDot : ""}`} />
                  ))}
                </div>
                <div className={styles.count}>{done} of {shown.length} understood</div>
                <div className={styles.links}>
                  <Link href={topic.href}>Topic page →</Link>
                  <Link href={topic.cheatSheetHref}>Cheat sheet</Link>
                </div>
                <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={bodyId} onClick={() => setToggled((state) => ({ ...state, [topic.n]: !open }))}>
                  <span className={styles.srOnly}>{open ? "Collapse" : "Expand"} {topic.name}</span>
                </button>
              </div>
              <div className={styles.body} id={bodyId}>
                {level === "extension" ? <div className={`${styles.label} ${styles.labelSl}`}>{`● ${labels.base.toUpperCase()} AND ${labels.extension.toUpperCase()}`}</div> : null}
                <ol className={styles.rows}>
                  {sl.map((entry) => <Row key={entry.item} entry={entry} done={understood.has(entry.item)} next={entry.item === next?.item} />)}
                </ol>
                {level === "extension" ? (
                  <>
                    <div className={`${styles.label} ${styles.labelHl}`}>{`◆ ${labels.extensionOnly.toUpperCase()}`}</div>
                    <ol className={styles.rows}>
                      {ahl.map((entry) => <Row key={entry.item} entry={entry} done={understood.has(entry.item)} next={entry.item === next?.item} />)}
                    </ol>
                  </>
                ) : ahl.length ? (
                  <div className={styles.more}>+{ahl.length}{` ${labels.extensionOnly.replace(/ /g, "-")} lessons`}</div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <div className={styles.sheets}>
        <span className={styles.lbl}>Cheat sheets</span>
        <Link className={styles.sheetMain} href={`${base}/cheat-sheet`}>Whole course</Link>
        {topics.map((topic) => (
          <Link key={topic.n} href={topic.cheatSheetHref}>{topic.n} {topic.name}</Link>
        ))}
        <Link href={`${base}/glossary`}>Glossary</Link>
        <Link href={`${base}/command-terms`}>Command terms</Link>
      </div>
    </div>
  );
}
