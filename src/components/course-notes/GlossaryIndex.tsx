import "katex/dist/katex.min.css";
import Link from "next/link";
import type { CSSProperties } from "react";
import { lessonPath, type Course } from "@/lib/course-notes/course";
import { lessonLinks } from "@/lib/course-notes/inline";
import { MathHtml } from "./MathHtml";
import styles from "./cheatsheet.module.css";

const byTerm = (a: { term: string }, b: { term: string }) => a.term.localeCompare(b.term, "en", { sensitivity: "base" });
const letterOf = (term: string) => term.trim().charAt(0).toUpperCase();

export function GlossaryIndex({ course }: { course: Course }) {
  const base = `/revision-notes/${course.slug}`;
  const syllabusNames = new Map(course.items.items.map((entry) => [entry.item, entry.name]));
  const lessonHref = (item: string) => {
    const lesson = course.lessons.find((entry) => entry.item === item);
    return lesson ? lessonPath(course, lesson) : base;
  };
  const terms = [...course.glossary].sort(byTerm);
  const letters = [...new Set(terms.map((entry) => letterOf(entry.term)))];
  const termsOf = (letter: string) => terms.filter((entry) => letterOf(entry.term) === letter);
  return (
    <div className={`${styles.list} shell`}>
      <div className={styles.crumbs}><Link href={base}>{`${course.name} notes`}</Link> › Glossary</div>
      <h1>Glossary</h1>
      <p className={styles.lede}>Key terms in plain words, with the lesson that teaches each one.</p>
      {terms.length === 0 ? <p className={styles.empty}>No terms yet.</p> : null}
      <ul className={styles.jump} aria-label="Jump to letter">
        {letters.map((letter) => <li key={letter}><a href={`#letter-${letter}`}>{letter}</a></li>)}
      </ul>
      {letters.map((letter) => (
        <section key={letter} className={styles.group} aria-labelledby={`letter-${letter}`} style={{ "--entries": termsOf(letter).length } as CSSProperties}>
          <h2 id={`letter-${letter}`} className={styles.letter}>{letter}</h2>
          <dl>
            {termsOf(letter).map((entry) => {
              const lesson = course.lessons.find((l) => l.item === entry.lesson);
              return (
                <div key={entry.id} id={entry.id} className={styles.entry} data-term={entry.id}>
                  <dt>{entry.term}</dt>
                  <dd>
                    <MathHtml text={entry.definition} links={lessonLinks(entry.definition, lessonHref)} />
                    <span className={styles.taught} data-taught>
                      {lesson ? <>Taught in <Link href={lessonPath(course, lesson)}>{lesson.item} {lesson.title}</Link></> : `Taught in ${entry.lesson} ${syllabusNames.get(entry.lesson) ?? ""}`.trim()}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
