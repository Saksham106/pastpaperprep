// The IGCSE Physics 0625 course: the shared route wrappers, published (hidden again when the flag is off), with three-level items numbered
// by their syllabus code (1.5.1), practising by bank subtopic in one bank split into Core and Extended routes.
// Data-derived: it holds with no lessons written (as at the start) and with all 62.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));

import { getCourse, lessonPath } from "@/lib/course-notes/course";
import { notesLinksForBank } from "@/lib/course-notes/group-lessons";
import { lessonPractice } from "@/lib/course-notes/practice";
import { subtopicHref } from "@/lib/course-notes/subtopic-practice";
import { courseNotesVisible } from "@/lib/course-notes/visibility";
import { setCourseLessonsForTests, setCoursePublishedForTests } from "@/lib/course-notes/test-visibility";
import { lessonFixture } from "@/lib/course-notes/__fixtures__/lesson";
import { notesPaths } from "@/lib/revision-notes";
import * as homeRoute from "./igcse-physics-0625/page";
import * as lessonRoute from "./igcse-physics-0625/[topic]/[lesson]/page";

const course = getCourse("igcse-physics-0625")!;
const lessonParams = (path: string) => {
  const [, , , topic, lesson] = path.split("/");
  return { topic, lesson };
};

let saved: string | undefined;
beforeEach(() => { saved = process.env.NOTES_PREVIEW; delete process.env.NOTES_PREVIEW; });
afterEach(() => { if (saved === undefined) delete process.env.NOTES_PREVIEW; else process.env.NOTES_PREVIEW = saved; });

describe("IGCSE Physics 0625 course", () => {
  it("is published, with 58 syllabus sections and 4 practical items, numbered by syllabus code", async () => {
    expect(course.published).toBe(true);
    expect(courseNotesVisible(course.slug)).toBe(true);
    expect(course.items.items).toHaveLength(62);
    expect(course.items.items.map((entry) => entry.item)).toContain("1.5.1");
    expect(course.items.items.filter((entry) => entry.level === "Extended").map((entry) => entry.item)).toEqual(["1.6", "4.5.2"]);
    expect(course.lessons).toHaveLength(62);
    expect(await lessonRoute.generateStaticParams()).toHaveLength(62);
    const paths = notesPaths();
    expect(paths).toContain("/revision-notes/igcse-physics-0625");
    for (const lesson of course.lessons) expect(paths).toContain(lessonPath(course, lesson));
    expect(notesLinksForBank("igcse-physics-0625")).toBeDefined();
  });

  it("when unpublished: no lesson params, nothing in the sitemap, no bank links", async () => {
    const restore = setCoursePublishedForTests(false, "igcse-physics-0625");
    try {
      expect(courseNotesVisible(course.slug)).toBe(false);
      expect(await lessonRoute.generateStaticParams()).toEqual([]);
      await expect(lessonRoute.default({ params: Promise.resolve(lessonParams(lessonPath(course, course.lessons[0]))) })).rejects.toThrow();
      expect(notesPaths().some((path) => path.includes(course.slug))).toBe(false);
      expect(notesLinksForBank("igcse-physics-0625")).toBeUndefined();
    } finally {
      restore();
    }
  });

  it("gives a three-level item a dashed lesson URL that resolves back to it", async () => {
    process.env.NOTES_PREVIEW = "1";
    const restore = setCourseLessonsForTests(course.slug, { ...lessonFixture, sections: [{ id: "s", heading: "Forces", blocks: [{ type: "text", text: "A force can change shape." }] }], before: [] }, ["1.5.1"]);
    try {
      const lesson = course.lessons[0];
      expect(lessonPath(course, lesson)).toBe("/revision-notes/igcse-physics-0625/motion-forces-and-energy/1-5-1-effects-of-forces");
      expect(await lessonRoute.generateStaticParams()).toEqual([{ topic: "motion-forces-and-energy", lesson: "1-5-1-effects-of-forces" }]);
      const html = renderToStaticMarkup(<>{await lessonRoute.default({ params: Promise.resolve(lessonParams(lessonPath(course, lesson))) })}</>);
      expect(html).toContain("Effects of forces");
      // The server renders the Extended view; the level switch restores a saved Core choice in the browser.
      expect(html).toContain("subtopic=Effects+of+forces&amp;route=extended");
      expect(html).not.toMatch(/IB Diploma|katex-error/);
      expect((await homeRoute.generateMetadata()).alternates?.canonical).toBe("/revision-notes/igcse-physics-0625");
    } finally {
      restore();
    }
  });

  it("links each level to its own route of the one bank, and an Extended-only section's Core view to the Extended route", () => {
    expect(subtopicHref("igcse-physics-0625", "Effects of forces", true, "core")).toBe("/banks/igcse-physics-0625?free=0&subtopic=Effects+of+forces&route=core");
    const forces = lessonPractice(course, "1.5.1")!;
    expect(forces.hrefs).toEqual({
      base: "/banks/igcse-physics-0625?free=0&subtopic=Effects+of+forces&route=core",
      extension: "/banks/igcse-physics-0625?free=0&subtopic=Effects+of+forces&route=extended",
    });
    expect(forces.counts.base).toBeGreaterThan(0);
    expect(forces.counts.extension).toBeGreaterThan(0);
    const momentum = lessonPractice(course, "1.6")!;
    expect(momentum.extensionOnly).toBe(true);
    expect(momentum.counts.base).toBe(0);
    expect(momentum.hrefs.base).toBe(momentum.hrefs.extension);
    // Practical questions (papers 5 and 6) are on both routes, so both views count them.
    const practical = lessonPractice(course, "7.1")!;
    expect(practical.counts.base).toBe(practical.counts.extension);
  });
});
