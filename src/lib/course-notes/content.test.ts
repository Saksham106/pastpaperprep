import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { receiptHash } from "../../../scripts/notes/write-receipts.mjs";
import { buildIndexSource } from "../../../scripts/notes/build-content-index.mjs";
import { COURSES, coursePaths, getCourse, getLesson, isCourseVisible, lessonPath, lessonsForTopic, topicPath } from "./course";
import { COURSE_FLAGS } from "./visibility";
import type { Block } from "./types";
import { validateLesson } from "./validate";
import { snippetFileErrors } from "./calculators";
import { parseInline } from "./inline";
import { renderTex } from "./render";
import { setCoursePublishedForTests } from "./test-visibility";

const UNSAFE_SVG = /<script|\son\w+\s*=|javascript:|<foreignObject/i;

let restorePublished: (() => void) | undefined;
afterEach(() => {
  restorePublished?.();
  restorePublished = undefined;
  delete process.env.NOTES_PREVIEW;
});

describe("course registry", () => {
  it("lists every course folder once, and visibility.ts reads the same courses", () => {
    const folders = readdirSync(join(process.cwd(), "src/content/notes"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(process.cwd(), "src/content/notes", entry.name, "course.json")))
      .map((entry) => entry.name)
      .sort();
    expect(COURSES.map((course) => course.slug).sort()).toEqual(folders);
    expect(COURSE_FLAGS.map((course) => course.slug).sort()).toEqual(folders);
    for (const course of COURSES) expect(getCourse(course.slug)).toBe(course);
  });

  it("every course's level config is complete and its items use only its two levels", () => {
    for (const course of COURSES) {
      const { base, extension, labels } = course.levels;
      expect(base, course.slug).not.toBe(extension);
      expect(labels.base && labels.extension && labels.extensionOnly, course.slug).toBeTruthy();
      expect(Object.keys(course.banks).sort(), course.slug).toEqual([labels.base, labels.extension].sort());
      for (const entry of course.items.items) expect([base, extension], `${course.slug} ${entry.item}`).toContain(entry.level);
      for (const topic of course.topics) expect(course.items.items.some((entry) => entry.topic === topic.n), `${course.slug} topic ${topic.n}`).toBe(true);
    }
  });
});

describe.each(COURSES.map((course) => [course.slug, course] as const))("%s course content", (slug, course) => {
  const items = course.items;
  const root = join(process.cwd(), "src/content/notes", slug);
  const lessonItems = new Set(items.items.map((entry) => entry.item));
  const calculators = course.calculators.map((model) => model.id);
  const ctx = { items, glossary: course.glossary, lessonItems, levels: course.levels, calculators, calculatorSnippets: course.calculatorSnippets };

  it("every lesson file passes validateLesson", () => {
    expect(course.lessons.length).toBeGreaterThan(0);
    // Report every failing lesson at once, keyed by item, so a writer can find the errors for their own lesson.
    const failures = Object.fromEntries(course.lessons.map((lesson) => [lesson.item, validateLesson(lesson, ctx)]).filter(([, errors]) => errors.length));
    expect(failures).toEqual({});
  });

  it("has no glossary stub definitions once published", () => {
    const stubs = course.glossary.filter((term) => term.definition.startsWith("TODO:")).map((term) => term.id);
    if (course.published) expect(stubs).toEqual([]);
  });

  it("names its calculators once each, and its calculator.json snippets give steps for exactly those", () => {
    expect(calculators.length, slug).toBeGreaterThan(0);
    expect(new Set(calculators).size).toBe(calculators.length);
    expect(snippetFileErrors(course.calculatorSnippets, calculators)).toEqual([]);
  });

  it("glossary lives in one file per lesson, named by a real item, and the index merges them all", () => {
    const dir = join(root, "glossary");
    const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".json")) : [];
    for (const file of files) expect(lessonItems.has(file.replace(/\.json$/, "").replace("-", ".")), file).toBe(true);
    expect(existsSync(join(root, "glossary.json"))).toBe(false);
    const ids = new Set(files.flatMap((file) => (JSON.parse(readFileSync(join(dir, file), "utf8")) as { id: string }[]).map((entry) => entry.id)));
    expect(new Set(course.glossary.map((entry) => entry.id))).toEqual(ids);
  });

  it("cheat-sheet method lines, command terms and glossary text parse, render and link to real lessons", () => {
    const texts = [
      ...Object.entries(course.cheatSheets).flatMap(([slug, sheet]) => sheet.lines.map((line, i) => [`cheatsheets/${slug}[${i}]`, line.text] as const)),
      ...course.commandTerms.map((term) => [`command-terms/${term.id}`, term.definition] as const),
      ...course.glossary.map((term) => [`glossary/${term.id}`, term.definition] as const),
    ];
    for (const sheet of Object.keys(course.cheatSheets)) expect(course.topics.map((topic) => topic.slug)).toContain(sheet);
    if (course.published) {
      expect(Object.keys(course.cheatSheets).sort()).toEqual(course.topics.map((topic) => topic.slug).sort());
      expect(course.commandTerms.length).toBeGreaterThan(20);
    }
    for (const [where, text] of texts) {
      expect(text, where).not.toMatch(/\\["']/);
      const nodes = parseInline(text);
      for (const node of nodes) {
        if (node.kind === "math") expect(() => renderTex(node.tex, false), `${where}: ${node.tex}`).not.toThrow();
        if (node.kind === "lesson") expect(lessonItems.has(node.item), `${where}: ${node.item}`).toBe(true);
      }
    }
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
      // The hash covers the lesson, its sidecar, mathparse.py, check-math.py and verify_kinds.py, so weakening a sidecar also invalidates the receipt.
      const sha256 = receiptHash(lesson.item, slug);
      expect(receipts[lesson.item], `${lesson.item} has no maths receipt; run node scripts/notes/write-receipts.mjs --course ${slug}`).toBeDefined();
      expect(receipts[lesson.item].sha256, `${lesson.item} (or its sidecar / mathparse.py / verify_kinds.py) changed since its receipt; run node scripts/notes/write-receipts.mjs --course ${slug}`).toBe(sha256);
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

  it.skipIf(!course.published)("a published course has a lesson for every syllabus item", () => {
    expect(course.lessons.map((lesson) => lesson.item).sort()).toEqual([...lessonItems].sort());
  });

  it.runIf(slug === "ib-math-aa")("builds paths in the documented shape", () => {
    const lesson = getLesson("ib-math-aa", "5.16")!;
    expect(lesson).toBeDefined();
    expect(topicPath(course, 5)).toBe("/revision-notes/ib-math-aa/calculus");
    expect(lessonPath(course, lesson)).toBe(`/revision-notes/ib-math-aa/calculus/5-16-${lesson.slug}`);
    expect(lessonsForTopic(course, 5).map((entry) => entry.item)).toContain("5.16");
    expect(course.topics.map((topic) => topic.slug)).toEqual(["number-and-algebra", "functions", "geometry-and-trigonometry", "statistics-and-probability", "calculus"]);
    expect(COURSES).toContain(course);
  });

  it("unpublished course yields no static params and no sitemap paths unless NOTES_PREVIEW=1", () => {
    restorePublished = setCoursePublishedForTests(false, slug);
    const mine = () => coursePaths().filter((path) => path.startsWith(`/revision-notes/${slug}`));
    expect(course.published).toBe(false);
    expect(isCourseVisible(course)).toBe(false);
    expect(mine()).toEqual([]);
    process.env.NOTES_PREVIEW = "1";
    expect(isCourseVisible(course)).toBe(true);
    const paths = mine();
    expect(paths).toContain(`/revision-notes/${slug}`);
    for (const lesson of course.lessons) expect(paths).toContain(lessonPath(course, lesson));
    for (const topic of course.topics) expect(paths).toContain(topicPath(course, topic.n));
    expect(paths).toContain(`/revision-notes/${slug}/cheat-sheet`);
    for (const topic of course.topics) expect(paths).toContain(`${topicPath(course, topic.n)}/cheat-sheet`);
    expect(paths.includes(`/revision-notes/${slug}/glossary`)).toBe(course.glossary.length > 0);
    expect(paths.includes(`/revision-notes/${slug}/command-terms`)).toBe(course.commandTerms.length > 0);
  });

});


describe("figure SVG safety", () => {
  it("the unsafe-markup pattern rejects script, event handlers, javascript: and foreignObject", () => {
    for (const bad of ["<svg><script>x</script></svg>", '<svg onload="x()"></svg>', '<svg><a href="javascript:x"/></svg>', "<svg><foreignObject/></svg>", "<svg\nonclick = 'x'></svg>"]) expect(UNSAFE_SVG.test(bad), bad).toBe(true);
    expect(UNSAFE_SVG.test('<svg viewBox="0 0 1 1"><path d="M0 0L1 1"/></svg>')).toBe(false);
  });

});
