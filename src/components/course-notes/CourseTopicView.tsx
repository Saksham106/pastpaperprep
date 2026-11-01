"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { LevelSwitch, useNotesLevel, type NotesLevel } from "./LevelSwitch";
import { useNotesContext } from "./notes-context";
import { trackPracticeClick } from "./track";
import { useNotesProgress } from "./useNotesProgress";
import styles from "./course-notes.module.css";

export type StageLesson = { item: string; name: string; level: "SL" | "AHL"; href?: string; summary?: string };
export type TopicStage = {
  id: string;
  name: string;
  hlOnly: boolean;
  counts: { SL: number; HL: number };
  hrefs: { SL: string; HL: string };
  lessons: StageLesson[];
};

function Stage({ stage, level, understood, nextItem }: { stage: TopicStage; level: NotesLevel; understood: Set<string>; nextItem?: string }) {
  const ctx = useNotesContext();
  const shown = stage.lessons.filter((lesson) => level === "HL" || lesson.level === "SL");
  if (!shown.length) return null;
  const done = shown.filter((lesson) => understood.has(lesson.item)).length;
  const progress = done === shown.length ? "full" : done > 0 ? "part" : "none";
  const questions = stage.hlOnly ? `${stage.counts.HL} HL questions` : `${stage.counts.SL} SL · ${stage.counts.HL} HL questions`;
  return (
    <div className={styles.stage} data-stage={stage.id} data-progress={progress} style={{ "--p": `${Math.round((100 * done) / shown.length)}%` } as CSSProperties}>
      <span className={styles.node} aria-hidden="true" />
      <div className={styles.gName} data-group-name>{shown.length > 1 ? stage.name : ""}</div>
      <div className={styles.gQs}><Link href={stage.hrefs[level]} onClick={() => trackPracticeClick(ctx, level === "SL" ? "ib-sl" : "ib-hl", stage.id)} title={`Practice: ${stage.name}`}>{questions}</Link></div>
      <div className={styles.cards}>
        {shown.map((lesson) => {
          const isDone = understood.has(lesson.item);
          const isNext = lesson.item === nextItem;
          const cls = [styles.card, isDone ? styles.cardDone : "", isNext ? styles.cardNext : "", lesson.href ? "" : styles.cardUnwritten].filter(Boolean).join(" ");
          const inner = (
            <>
              <span className={styles.cn}><span>{lesson.item}{lesson.level === "AHL" ? <span className={styles.ahlTag} data-ahl-tag>◆ HL</span> : null}</span><b>{isDone ? "✓" : isNext ? "Next up" : ""}</b></span>
              <span className={styles.ct}>{lesson.name}</span>
              {lesson.href ? (lesson.summary ? <span className={styles.tip}>{lesson.summary}</span> : null) : <span className={styles.cs}>Not written yet</span>}
            </>
          );
          return lesson.href ? (
            <Link key={lesson.item} data-lesson={lesson.item} className={cls} href={lesson.href} title={lesson.summary} aria-label={`${lesson.item} ${lesson.name}${lesson.level === "AHL" ? ", HL only" : ""}${isDone ? ", understood" : ""}${isNext ? ", next up" : ""}`}>{inner}</Link>
          ) : (
            <div key={lesson.item} data-lesson={lesson.item} className={cls}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

export function CourseTopicView({ topic, courseHref, stages }: { topic: { n: number; name: string; cheatSheetHref: string; questionTotals: { SL: number; HL: number } }; courseHref: string; stages: TopicStage[] }) {
  const [level, setLevel] = useNotesLevel();
  const { understood } = useNotesProgress();

  const visible = (lesson: StageLesson) => level === "HL" || lesson.level === "SL";
  const all = stages.flatMap((stage) => stage.lessons);
  const shownCount = all.filter(visible).length;
  const hlOnlyCount = all.filter((lesson) => lesson.level === "AHL").length;
  const next = all.find((lesson) => visible(lesson) && lesson.href && !understood.has(lesson.item));
  const sl = stages.filter((stage) => !stage.hlOnly);
  const hl = stages.filter((stage) => stage.hlOnly);
  const bandCount = (list: TopicStage[]) => list.reduce((sum, stage) => sum + stage.lessons.filter(visible).length, 0);

  return (
    <main className={`${styles.topicPage} shell`} data-view={level} style={{ "--tone": `var(--t${topic.n})`, "--tone-ink": `var(--t${topic.n}-ink)` } as CSSProperties}>
      <div className={styles.tTop}>
        <div className={styles.crumbs}>
          <Link href={courseHref}>IB Maths AA notes</Link> › Topic {topic.n}
        </div>
        <div className={styles.tRow}>
          <div>
            <div className={styles.tNum}>TOPIC {topic.n}</div>
            <h1>{topic.name}</h1>
            <p className={styles.tMeta}>
              {shownCount} lessons{level === "HL" ? ` · ${hlOnlyCount} HL only` : ""} · {topic.questionTotals[level]} past-paper questions in the {level} bank
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
        <div className={styles.bandH}><h2>● SL AND HL</h2><span>{bandCount(sl)} lessons</span></div>
        <div className={styles.flow}>
          {sl.map((stage) => <Stage key={stage.id} stage={stage} level={level} understood={understood} nextItem={next?.item} />)}
        </div>
      </section>
      {hl.length ? (
        <section className={`${styles.band} ${styles.bandHl}`} data-band="hl" data-dimmed={level === "SL" ? "true" : "false"}>
          <div className={styles.bandH}>
            <h2>◆ HL ONLY</h2><span>{bandCount(hl) || hl.reduce((sum, stage) => sum + stage.lessons.length, 0)} lessons</span>
            {level === "SL" ? <span className={styles.slNote}>· switch to HL to study these</span> : null}
          </div>
          <div className={styles.flow}>
            {hl.map((stage) => <Stage key={stage.id} stage={stage} level="HL" understood={understood} nextItem={next?.item} />)}
          </div>
        </section>
      ) : null}
    </main>
  );
}
