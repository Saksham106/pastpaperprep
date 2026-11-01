// Client-safe: assembles the cheat-sheet data from lessons and sheet-only lines. No katex here.
import { lessonPath, lessonsForTopic, topicPath, type Course } from "./course";
import type { FormulaTag, Level } from "./types";

export type SheetRow = { kind: "formula" | "fact" | "line"; /** TeX for formula, inline text otherwise. */ value: string; tag: FormulaTag };
export type SheetBlock = { key: string; /** Lesson item, absent for the method block. */ item?: string; title: string; href?: string; level: Level; rows: SheetRow[] };
export type SheetTopic = { n: number; name: string; href: string; blocks: SheetBlock[]; /** Every block is AHL: the topic heading is hidden in the SL view. */ allAhl: boolean };

export const METHOD_TITLE = "Which method when";

/** One topic's blocks in syllabus order: lesson blocks first, then the sheet-only method blocks (SL, then AHL). */
export function topicBlocks(course: Course, topic: Course["topics"][number]): SheetBlock[] {
  const lessonBlocks = lessonsForTopic(course, topic.n).flatMap((lesson): SheetBlock[] => {
    const rows = lesson.sections.flatMap((section) =>
      section.blocks.flatMap((block): SheetRow[] => {
        if (block.type === "formula" && block.cheatSheet) return [{ kind: "formula", value: block.tex, tag: block.tag }];
        if (block.type === "fact" && block.cheatSheet) return [{ kind: "fact", value: block.text, tag: block.tag }];
        return [];
      }),
    );
    return rows.length ? [{ key: lesson.item, item: lesson.item, title: lesson.title, href: lessonPath(course, lesson), level: lesson.level, rows }] : [];
  });
  const lines = course.cheatSheets[topic.slug]?.lines ?? [];
  const methodBlocks = (["SL", "AHL"] as const).flatMap((level): SheetBlock[] => {
    const rows = lines.filter((line) => line.level === level).map((line): SheetRow => ({ kind: "line", value: line.text, tag: line.tag }));
    return rows.length ? [{ key: `${topic.slug}-method-${level}`, title: METHOD_TITLE, level, rows }] : [];
  });
  return [...lessonBlocks, ...methodBlocks];
}

/** The topic sheet, or the course sheet (the union of the topic sheets) when `topic` is omitted. */
export function sheetTopics(course: Course, topic?: Course["topics"][number]): SheetTopic[] {
  return (topic ? [topic] : course.topics)
    .map((entry) => ({ n: entry.n, name: entry.name, href: topicPath(course, entry.n), blocks: topicBlocks(course, entry), allAhl: false }))
    .filter((entry) => entry.blocks.length > 0)
    .map((entry) => ({ ...entry, allAhl: entry.blocks.every((block) => block.level === "AHL") }));
}
