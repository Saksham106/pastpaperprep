// The IB Maths AI course: the same thin route wrappers as IB Physics, practising by bank subtopic, with lessons that
// also teach further bank subtopics (`alsoPractises`) so every label but one links to a lesson.
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; prefetch?: unknown }) => {
    delete rest.prefetch;
    return <a href={href} {...rest}>{children}</a>;
  },
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

import { cleanup, render } from "@testing-library/react";
import { PractiseBand } from "@/components/course-notes/LessonActions";
import { CourseNotesProvider } from "@/components/course-notes/notes-context";
import { resetPersistedStoresForTests } from "@/components/course-notes/persisted-store";
import { clientCourse } from "@/lib/course-notes/client-course";
import { getCourse, lessonPath, topicPath } from "@/lib/course-notes/course";
import { notesLinksForBank } from "@/lib/course-notes/group-lessons";
import { lessonPractice } from "@/lib/course-notes/practice";
import { courseNotesVisible, notesNavVisible } from "@/lib/course-notes/visibility";
import { setCoursePublishedForTests } from "@/lib/course-notes/test-visibility";
import { notesPaths } from "@/lib/revision-notes";
import * as homeRoute from "./ib-math-ai/page";
import * as topicRoute from "./ib-math-ai/[topic]/page";
import * as lessonRoute from "./ib-math-ai/[topic]/[lesson]/page";
import * as cheatRoute from "./ib-math-ai/cheat-sheet/page";
import * as topicCheatRoute from "./ib-math-ai/[topic]/cheat-sheet/page";
import * as glossaryRoute from "./ib-math-ai/glossary/page";
import * as commandRoute from "./ib-math-ai/command-terms/page";

const course = getCourse("ib-math-ai")!;
const firstTopic = course.topics[0];
const topic = { params: Promise.resolve({ topic: firstTopic.slug }) };
const staticRoutes = [homeRoute, cheatRoute, glossaryRoute, commandRoute];
const topicRoutes = [topicRoute, topicCheatRoute];
const lessonParams = (path: string) => {
  const [, , , topicParam, lessonParam] = path.split("/");
  return { topic: topicParam, lesson: lessonParam };
};

let saved: string | undefined;
beforeEach(() => { saved = process.env.NOTES_PREVIEW; delete process.env.NOTES_PREVIEW; });
afterEach(() => { if (saved === undefined) delete process.env.NOTES_PREVIEW; else process.env.NOTES_PREVIEW = saved; });

describe("IB Maths AI course routes", () => {
  it("is published, with all 78 lessons, params and sitemap paths without a preview flag", async () => {
    expect(course.published).toBe(true);
    expect(course.items.items).toHaveLength(78);
    expect(course.lessons).toHaveLength(78);
    expect(courseNotesVisible(course.slug)).toBe(true);
    expect(await lessonRoute.generateStaticParams()).toHaveLength(78);
    const paths = notesPaths();
    expect(paths).toContain("/revision-notes/ib-math-ai");
    for (const entry of course.topics) expect(paths).toContain(topicPath(course, entry.n));
    for (const lesson of course.lessons) expect(paths).toContain(lessonPath(course, lesson));
    expect((await homeRoute.generateMetadata()).alternates?.canonical).toBe("/revision-notes/ib-math-ai");
  });

  it("when unpublished: no params, every page 404s, nothing in the sitemap", async () => {
    const restore = setCoursePublishedForTests(false, "ib-math-ai");
    try {
      expect(courseNotesVisible(course.slug)).toBe(false);
      for (const route of [...staticRoutes, ...topicRoutes, lessonRoute]) {
        expect(route.dynamicParams).toBe(false);
        expect(await route.generateStaticParams()).toEqual([]);
      }
      for (const route of staticRoutes) await expect(route.default()).rejects.toThrow();
      for (const route of topicRoutes) await expect(route.default(topic)).rejects.toThrow();
      await expect(lessonRoute.default({ params: Promise.resolve(lessonParams(lessonPath(course, course.lessons[0]))) })).rejects.toThrow();
      expect(notesPaths().some((path) => path.includes(course.slug))).toBe(false);
      expect(notesLinksForBank("ib-ai-hl")).toBeUndefined();
      expect(notesNavVisible()).toBe(true);
    } finally {
      restore();
    }
  });

  it("renders the home, a topic and a lesson without KaTeX errors or another course's names", async () => {
    const home = renderToStaticMarkup(<>{await homeRoute.default()}</>);
    expect(home).toContain(">SL</button>");
    expect(home).toContain(">HL</button>");
    expect(home).not.toMatch(/Physics|Chemistry|0580|Extended|Core\b/);
    const topicHtml = renderToStaticMarkup(<>{await topicRoute.default(topic)}</>);
    expect(topicHtml).toMatch(/\d+ SL · \d+ HL questions/);
    expect(topicHtml).toContain('href="/banks/ib-ai-hl?');
    const lesson = course.lessons.find((entry) => entry.item === "4.11")!;
    const html = renderToStaticMarkup(<>{await lessonRoute.default({ params: Promise.resolve(lessonParams(lessonPath(course, lesson))) })}</>);
    expect(html).toContain(lessonPractice(course, lesson.item)!.hrefs.extension.replace(/&/g, "&amp;"));
    expect(html).not.toMatch(/katex-error|Physics|Chemistry|0580/);
  });

  it("links every bank subtopic but Partial fractions to the lesson that teaches it", () => {
    const sl = notesLinksForBank("ib-ai-sl")!;
    const hl = notesLinksForBank("ib-ai-hl")!;
    const lesson = (item: string) => lessonPath(course, course.lessons.find((entry) => entry.item === item)!);
    expect(sl["The t-test"].href).toBe(lesson("4.11"));
    expect(sl["Sinusoidal models"].href).toBe(lesson("2.5"));
    expect(sl["Outliers and data interpretation"].href).toBe(lesson("4.1"));
    expect(sl["Applications of integration"].href).toBe(lesson("5.5"));
    // AHL lessons link only from the HL bank.
    expect(sl["Type I and Type II errors"]).toBeUndefined();
    expect(hl["Type I and Type II errors"].href).toBe(lesson("4.18"));
    expect(hl["Travelling salesman problem"].href).toBe(lesson("3.16"));
    expect(hl["Related rates of change"].href).toBe(lesson("5.9"));
    expect(hl["Partial fractions"]).toBeUndefined();
    // The extra labels have counts to show.
    const practice = lessonPractice(course, "4.11")!;
    expect(practice.more).toEqual([{ name: "The t-test", counts: { base: expect.any(Number), extension: expect.any(Number) }, hrefs: { base: "/banks/ib-ai-sl?free=0&subtopic=The+t-test", extension: "/banks/ib-ai-hl?free=0&subtopic=The+t-test" } }]);
  });

  it("adds an Also line to the practise band for the subtopics a lesson also teaches", () => {
    const band = (item: string, level: "SL" | "HL") => {
      window.localStorage.setItem("notes-level:ib-math-ai", level);
      resetPersistedStoresForTests();
      const practice = lessonPractice(course, item)!;
      const view = render(<CourseNotesProvider course={clientCourse(course)}><PractiseBand practice={practice} bankPrefix={course.copy.bankPrefix} /></CourseNotesProvider>);
      const paragraphs = [...view.container.querySelectorAll("p")].map((p) => p.textContent);
      const links = [...view.container.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
      cleanup();
      return { practice, paragraphs, links };
    };
    try {
      const sl = band("2.5", "SL");
      const counts = sl.practice.more!.map((extra) => extra.counts.base);
      expect(sl.paragraphs[1]).toBe(`Also: Modelling with linear and piecewise functions (${counts[0]}) · Direct and inverse variation (${counts[1]}) · Sinusoidal models (${counts[2]})`);
      expect(sl.links).toContainEqual(["Sinusoidal models", "/banks/ib-ai-sl?free=0&subtopic=Sinusoidal+models"]);
      // An AHL lesson's SL view points its extras at the HL bank too.
      const ahl = band("4.18", "SL");
      expect(ahl.links).toContainEqual(["Type I and Type II errors", "/banks/ib-ai-hl?free=0&subtopic=Type+I+and+Type+II+errors"]);
      // A lesson with no extras has no Also line.
      expect(band("1.1", "SL").paragraphs).toHaveLength(1);
    } finally {
      window.localStorage.clear();
      resetPersistedStoresForTests();
    }
  });
});
