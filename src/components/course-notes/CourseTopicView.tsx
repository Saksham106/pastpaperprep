"use client";

import Link from "next/link";
import { useId, useState, type CSSProperties } from "react";
import type { StageLesson, TopicStage } from "@/lib/course-notes/practice";
import type { PerView, ViewLevel } from "@/lib/course-notes/types";
import { LevelSwitch, useNotesLevel } from "./LevelSwitch";
import { useCourse, useNotesContext } from "./notes-context";
import { trackPracticeClick } from "./track";
import { useNotesProgress } from "./useNotesProgress";
import styles from "./course-notes.module.css";

export type { StageLesson, TopicStage };

function LessonCard({ lesson, done, next }: { lesson: StageLesson; done: boolean; next: boolean }) {
  const { levels } = useCourse();
  const extension = lesson.level === levels.extension;
  const [tipOpen, setTipOpen] = useState(false);
  const tipId = useId();
  const cls = [styles.card, done ? styles.cardDone : "", next ? styles.cardNext : "", lesson.href ? styles.cardLinked : styles.cardUnwritten].filter(Boolean).join(" ");
  const inner = (
    <>
      <span className={styles.cn}><span>{lesson.item}{extension ? <span className={styles.ahlTag} data-ahl-tag>{`◆ ${levels.labels.extension}`}</span> : null}</span><b>{done ? "✓" : next ? "Next up" : ""}</b></span>
      <span className={styles.ct}>{lesson.name}</span>
      {lesson.href ? null : <span className={styles.cs}>Not written yet</span>}
    </>
  );
  if (!lesson.href) return <div data-lesson={lesson.item} className={cls}>{inner}</div>;
  const label = `${lesson.item} ${lesson.name}${extension ? `, ${levels.labels.extensionOnly}` : ""}${done ? ", understood" : ""}${next ? ", next up" : ""}`;
  return (
    <div data-lesson={lesson.item} className={cls}>
      <Link className={styles.cardLink} href={lesson.href} aria-label={label}>{inner}</Link>
      {lesson.summary ? (
        <>
          {/* A link cannot hold a button, so the summary toggle sits beside it: focusable, and tappable on touch. */}
          <button type="button" className={styles.tipBtn} aria-expanded={tipOpen} aria-controls={tipId} aria-label={`About ${lesson.item} ${lesson.name}`} onClick={() => setTipOpen((value) => !value)}>
            <span aria-hidden="true">i</span>
          </button>
          <p id={tipId} className={styles.tip} hidden={!tipOpen}>{lesson.summary}</p>
        </>
      ) : null}
    </div>
  );
}

function Stage({ stage, level, understood, nextItem }: { stage: TopicStage; level: ViewLevel; understood: Set<string>; nextItem?: string }) {
  const ctx = useNotesContext();
  const course = useCourse();
  const labels = course.levels.labels;
  const shown = stage.lessons.filter((lesson) => level === "extension" || lesson.level === course.levels.base);
  if (!shown.length) return null;
  const done = shown.filter((lesson) => understood.has(lesson.item)).length;
  const progress = done === shown.length ? "full" : done > 0 ? "part" : "none";
  const questions = stage.hlOnly ? `${stage.counts.extension} ${labels.extension} questions` : `${stage.counts.base} ${labels.base} · ${stage.counts.extension} ${labels.extension} questions`;
  return (
    <div className={styles.stage} data-stage={stage.id} data-progress={progress} style={{ "--p": `${Math.round((100 * done) / shown.length)}%` } as CSSProperties}>
      <span className={styles.node} aria-hidden="true" />
      <div className={styles.gName} data-group-name>{shown.length > 1 ? stage.name : ""}</div>
      <div className={styles.gQs}>{stage.counts[stage.hlOnly ? "extension" : level] === 0 ? <span>{questions}</span> : <Link href={stage.hrefs[level]} onClick={() => trackPracticeClick(ctx, course.banks[level], stage.id)} title={`Practice: ${stage.name}`}>{questions}</Link>}</div>
      <div className={styles.cards}>
        {shown.map((lesson) => (
          <LessonCard key={lesson.item} lesson={lesson} done={understood.has(lesson.item)} next={lesson.item === nextItem} />
        ))}
      </div>
    </div>
  );
}

export function CourseTopicView({ topic, courseHref, stages }: { topic: { n: number; name: string; cheatSheetHref: string; questionTotals: PerView<number> }; courseHref: string; stages: TopicStage[] }) {
  const course = useCourse();
  const { levels } = course;
  const labels = levels.labels;
  const [level, setLevel] = useNotesLevel();
  const { understood } = useNotesProgress();

  const visible = (lesson: StageLesson) => level === "extension" || lesson.level === levels.base;
  const all = stages.flatMap((stage) => stage.lessons);
  const shownCount = all.filter(visible).length;
  const hlOnlyCount = all.filter((lesson) => lesson.level === levels.extension).length;
  const next = all.find((lesson) => visible(lesson) && lesson.href && !understood.has(lesson.item));
  const sl = stages.filter((stage) => !stage.hlOnly);
  const hl = stages.filter((stage) => stage.hlOnly);
  const bandCount = (list: TopicStage[]) => list.reduce((sum, stage) => sum + stage.lessons.filter(visible).length, 0);

  return (
    <div className={`${styles.topicPage} shell`} data-view={labels[level]} style={{ "--tone": `var(--t${topic.n})`, "--tone-ink": `var(--t${topic.n}-ink)` } as CSSProperties}>
      <div className={styles.tTop}>
        <div className={styles.crumbs}>
          <Link href={courseHref}>{`${course.name} notes`}</Link> › Topic {topic.n}
        </div>
        <div className={styles.tRow}>
          <div>
            <div className={styles.tNum}>TOPIC {topic.n}</div>
            <h1>{topic.name}</h1>
            <p className={styles.tMeta}>
              {shownCount} lessons{level === "extension" ? ` · ${hlOnlyCount} ${labels.extensionOnly}` : ""} · {topic.questionTotals[level]} past-paper questions {course.bankPhrase.replace("{level}", labels[level])}
            </p>
          </div>
          <div className={styles.tActions}>
            <LevelSwitch level={level} onChange={setLevel} />
            <Link className={styles.btnQuiet} href={topic.cheatSheetHref}>{topic.name} cheat sheet</Link>
            {next?.href ? <Link className={styles.btnPrimary} href={next.href}>Continue: {next.item} →</Link> : null}
          </div>
        </div>
      </div>

      <section className={`${styles.band} ${styles.bandSl}`} data-band="sl" data-dimmed="false">
        <div className={styles.bandH}><h2>{`● ${labels.base.toUpperCase()} AND ${labels.extension.toUpperCase()}`}</h2><span>{bandCount(sl)} lessons</span></div>
        <div className={styles.flow}>
          {sl.map((stage) => <Stage key={stage.id} stage={stage} level={level} understood={understood} nextItem={next?.item} />)}
        </div>
      </section>
      {hl.length ? (
        <section className={`${styles.band} ${styles.bandHl}`} data-band="hl" data-dimmed={level === "base" ? "true" : "false"}>
          <div className={styles.bandH}>
            <h2>{`◆ ${labels.extensionOnly.toUpperCase()}`}</h2><span>{bandCount(hl) || hl.reduce((sum, stage) => sum + stage.lessons.length, 0)} lessons</span>
            {level === "base" ? <span className={styles.slNote}>{`· switch to ${labels.extension} to study these`}</span> : null}
          </div>
          <div className={styles.flow}>
            {hl.map((stage) => <Stage key={stage.id} stage={stage} level="extension" understood={understood} nextItem={next?.item} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
