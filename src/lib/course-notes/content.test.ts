import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import itemsJson from "@/data/aa-official-subtopics/items.json";
import { receiptHash } from "../../../scripts/notes/write-receipts.mjs";
import { buildIndexSource } from "../../../scripts/notes/build-content-index.mjs";
import { COURSES, coursePaths, getCourse, getLesson, isCourseVisible, lessonPath, lessonsForTopic, topicPath } from "./course";
import type { Block, ItemsFile } from "./types";
import { validateLesson } from "./validate";

const items = itemsJson as ItemsFile;
const course = getCourse("ib-math-aa")!;
const root = join(process.cwd(), "src/content/notes/ib-math-aa");
const lessonItems = new Set(items.items.map((entry) => entry.item));
const ctx = { items, glossary: course.glossary, lessonItems };

afterEach(() => {
  delete process.env.NOTES_PREVIEW;
});

describe("ib-math-aa course content", () => {
  it("every lesson file passes validateLesson", () => {
    expect(course.lessons.length).toBeGreaterThan(0);
    // Report every failing lesson at once, keyed by item, so a writer can find the errors for their own lesson.
    const failures = Object.fromEntries(course.lessons.map((lesson) => [lesson.item, validateLesson(lesson, ctx)]).filter(([, errors]) => errors.length));
    expect(failures).toEqual({});
  });

  it("glossary lives in one file per lesson, named by a real item, and the index merges them all", () => {
    const dir = join(root, "glossary");
    const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
    for (const file of files) expect(lessonItems.has(file.replace(/\.json$/, "").replace("-", ".")), file).toBe(true);
    expect(existsSync(join(root, "glossary.json"))).toBe(false);
    const ids = new Set(files.flatMap((file) => (JSON.parse(readFileSync(join(dir, file), "utf8")) as { id: string }[]).map((entry) => entry.id)));
    expect(new Set(course.glossary.map((entry) => entry.id))).toEqual(ids);
  });

  it("every glossary term points at a real lesson item", () => {
    for (const term of course.glossary) expect(lessonItems.has(term.lesson), term.id).toBe(true);
  });

  it("prerequisite graph is acyclic and only references existing lessons", () => {
    const byItem = new Map(course.lessons.map((lesson) => [lesson.item, lesson]));
    for (const lesson of course.lessons) {
      for (const prerequisite of lesson.prerequisites) {
        // Not every lesson is written yet, so prerequisites must be real syllabus items; once a lesson exists it is walked below.
        expect(lessonItems.has(prerequisite), `${lesson.item} -> ${prerequisite}`).toBe(true);
      }
    }
    const state = new Map<string, "visiting" | "done">();
    const visit = (item: string, trail: string[]) => {
      if (state.get(item) === "done") return;
      expect(state.get(item), `cycle: ${[...trail, item].join(" -> ")}`).not.toBe("visiting");
      state.set(item, "visiting");
      for (const prerequisite of byItem.get(item)?.prerequisites ?? []) visit(prerequisite, [...trail, item]);
      state.set(item, "done");
    };
    for (const lesson of course.lessons) visit(lesson.item, []);
  });

  it("lesson without a passing receipt for its current hash fails npm test", () => {
    const receipts = JSON.parse(readFileSync(join(root, "math-receipts.json"), "utf8")) as Record<string, { sha256: string; passedAt: string }>;
    for (const lesson of course.lessons) {
      // The hash covers the lesson, its sidecar, mathparse.py and check-math.py, so weakening a sidecar also invalidates the receipt.
      const sha256 = receiptHash(lesson.item);
      expect(receipts[lesson.item], `${lesson.item} has no maths receipt; run node scripts/notes/write-receipts.mjs`).toBeDefined();
      expect(receipts[lesson.item].sha256, `${lesson.item} (or its sidecar / mathparse.py) changed since its receipt; run node scripts/notes/write-receipts.mjs`).toBe(sha256);
      expect(receipts[lesson.item].passedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });

  it("each lesson's slug is unique per topic and item is unique", () => {
    const seen = new Set<string>();
    const items_ = new Set<string>();
    for (const lesson of course.lessons) {
      const key = `${lesson.topic}/${lesson.slug}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
      expect(items_.has(lesson.item), lesson.item).toBe(false);
      items_.add(lesson.item);
    }
  });

  it("every figure block has an svg file and the lesson file name matches its item", () => {
    const ids = course.lessons.flatMap((lesson) => lesson.sections.flatMap((section) => section.blocks.filter((block): block is Extract<Block, { type: "figure" }> => block.type === "figure")));
    for (const figure of ids) expect(course.figures[figure.id], figure.id).toMatch(/^<svg/);
    for (const lesson of course.lessons)
      for (const section of lesson.sections)
        for (const block of section.blocks) if (block.type === "figure") expect(block.id, block.id).toMatch(new RegExp(`^${lesson.item.replace(".", "-")}-`));
    const files = readdirSync(join(root, "lessons")).filter((name) => name.endsWith(".json")).sort();
    expect(files).toEqual(course.lessons.map((lesson) => `${lesson.item.replace(".", "-")}.json`).sort());
  });

  it("generated index is up to date with the content folder", () => {
    expect(readFileSync(join(root, "index.ts"), "utf8")).toBe(buildIndexSource(root));
  });

  it.skipIf(course.lessons.length < 83 && !course.published)("a published course has all 83 lessons", () => {
    expect(course.lessons).toHaveLength(83);
  });

  it("builds paths in the documented shape", () => {
    const lesson = getLesson("ib-math-aa", "5.16")!;
    expect(lesson).toBeDefined();
    expect(topicPath(course, 5)).toBe("/revision-notes/ib-math-aa/calculus");
    expect(lessonPath(course, lesson)).toBe(`/revision-notes/ib-math-aa/calculus/5-16-${lesson.slug}`);
    expect(lessonsForTopic(course, 5).map((entry) => entry.item)).toContain("5.16");
    expect(course.topics.map((topic) => topic.slug)).toEqual(["number-and-algebra", "functions", "geometry-and-trigonometry", "statistics-and-probability", "calculus"]);
    expect(COURSES).toContain(course);
  });

  it("unpublished course yields no static params and no sitemap paths unless NOTES_PREVIEW=1", () => {
    expect(course.published).toBe(false);
    expect(isCourseVisible(course)).toBe(false);
    expect(coursePaths()).toEqual([]);
    process.env.NOTES_PREVIEW = "1";
    expect(isCourseVisible(course)).toBe(true);
    const paths = coursePaths();
    expect(paths).toContain("/revision-notes/ib-math-aa");
    expect(paths).toContain(lessonPath(course, getLesson("ib-math-aa", "5.16")!));
    expect(paths).toContain(topicPath(course, 5));
    expect(paths).toContain("/revision-notes/ib-math-aa/cheat-sheet");
    for (const topic of course.topics) expect(paths).toContain(`${topicPath(course, topic.n)}/cheat-sheet`);
    expect(paths).toContain("/revision-notes/ib-math-aa/glossary");
    expect(paths).toContain("/revision-notes/ib-math-aa/command-terms");
  });
});

const UNSAFE_SVG = /<script|\son\w+\s*=|javascript:|<foreignObject/i;

describe("figure SVG safety", () => {
  it("the unsafe-markup pattern rejects script, event handlers, javascript: and foreignObject", () => {
    for (const bad of ["<svg><script>x</script></svg>", '<svg onload="x()"></svg>', '<svg><a href="javascript:x"/></svg>', "<svg><foreignObject/></svg>", "<svg\nonclick = 'x'></svg>"]) expect(UNSAFE_SVG.test(bad), bad).toBe(true);
    expect(UNSAFE_SVG.test('<svg viewBox="0 0 1 1"><path d="M0 0L1 1"/></svg>')).toBe(false);
  });

  it("no figure SVG contains script, event handlers, javascript: URLs or foreignObject", () => {
    const dir = join(root, "figures");
    const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".svg")) : [];
    for (const file of files) expect(readFileSync(join(dir, file), "utf8"), file).not.toMatch(UNSAFE_SVG);
  });
});
