// The IB Chemistry course: the same thin route wrappers as 0580, hidden until published, practising by bank subtopic.
// Data-derived: it holds with no lessons written (as at the start) and with all 71.
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
import { lessonPractice } from "@/lib/course-notes/practice";
import { courseNotesVisible, notesNavVisible } from "@/lib/course-notes/visibility";
import { setCourseLessonsForTests, setCoursePublishedForTests } from "@/lib/course-notes/test-visibility";
import { lessonFixture } from "@/lib/course-notes/__fixtures__/lesson";
import { notesPaths } from "@/lib/revision-notes";
import * as homeRoute from "./ib-chemistry/page";
import * as topicRoute from "./ib-chemistry/[topic]/page";
import * as lessonRoute from "./ib-chemistry/[topic]/[lesson]/page";
import * as cheatRoute from "./ib-chemistry/cheat-sheet/page";
import * as topicCheatRoute from "./ib-chemistry/[topic]/cheat-sheet/page";
import * as glossaryRoute from "./ib-chemistry/glossary/page";
import * as commandRoute from "./ib-chemistry/command-terms/page";

const course = getCourse("ib-chemistry")!;
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

describe("IB Chemistry course routes", () => {
  it("is published: params and sitemap paths without a preview flag", async () => {
    expect(course.published).toBe(true);
    expect(course.lessons).toHaveLength(71);
    expect(await lessonRoute.generateStaticParams()).toHaveLength(course.lessons.length);
    expect(notesPaths()).toContain(lessonPath(course, course.lessons[0]));
  });

  it("when unpublished: no params, every page 404s, nothing in the sitemap, no site links", async () => {
    const restore = setCoursePublishedForTests(false, "ib-chemistry");
    try {
      expect(course.published).toBe(false);
      expect(courseNotesVisible(course.slug)).toBe(false);
      for (const route of [...staticRoutes, ...topicRoutes, lessonRoute]) {
        expect(route.dynamicParams).toBe(false);
        expect(await route.generateStaticParams()).toEqual([]);
      }
      for (const route of staticRoutes) await expect(route.default()).rejects.toThrow();
      for (const route of topicRoutes) await expect(route.default(topic)).rejects.toThrow();
      const lesson = course.lessons[0];
      await expect(lessonRoute.default({ params: Promise.resolve(lesson ? lessonParams(lessonPath(course, lesson)) : { topic: firstTopic.slug, lesson: "1-1-x" }) })).rejects.toThrow();
      expect(notesPaths().some((path) => path.includes(course.slug))).toBe(false);
      // The header's Notes link is for the published courses, not this one.
      expect(notesNavVisible()).toBe(true);
    } finally {
      restore();
    }
  });

  it("emits its params and sitemap paths with NOTES_PREVIEW=1, lessons included once written", async () => {
    process.env.NOTES_PREVIEW = "1";
    for (const route of [homeRoute, cheatRoute]) expect(await route.generateStaticParams()).toEqual([{}]);
    const pageParams = (entries: unknown[]) => (entries.length ? [{}] : []);
    expect(await glossaryRoute.generateStaticParams()).toEqual(pageParams(course.glossary));
    expect(await commandRoute.generateStaticParams()).toEqual(pageParams(course.commandTerms));
    for (const route of topicRoutes) expect(await route.generateStaticParams()).toEqual(course.topics.map((entry) => ({ topic: entry.slug })));
    expect(await lessonRoute.generateStaticParams()).toEqual(course.lessons.map((entry) => lessonParams(lessonPath(course, entry))));
    const paths = notesPaths();
    expect(paths).toContain("/revision-notes/ib-chemistry");
    for (const entry of course.topics) expect(paths).toContain(topicPath(course, entry.n));
    for (const lesson of course.lessons) expect(paths).toContain(lessonPath(course, lesson));
    expect(paths.includes("/revision-notes/ib-chemistry/glossary")).toBe(course.glossary.length > 0);
    expect(paths.includes("/revision-notes/ib-chemistry/command-terms")).toBe(course.commandTerms.length > 0);
    expect((await homeRoute.generateMetadata()).alternates?.canonical).toBe("/revision-notes/ib-chemistry");
  });

  it("renders the home and topic pages with its own labels, strand names and subtopic practice links", async () => {
    process.env.NOTES_PREVIEW = "1";
    const home = renderToStaticMarkup(<>{await homeRoute.default()}</>);
    expect(home).toContain("› IB › Chemistry");
    expect(home).toContain("Follows the IB Chemistry guide for exams from May 2025.");
    expect(home).toContain(">SL</button>");
    expect(home).toContain(">HL</button>");
    expect(home).toContain("STRUCTURE 1");
    expect(home).toContain("REACTIVITY 3");
    expect(home).toContain(">TOPIC 7</div>");
    expect(home).not.toMatch(/Maths|0580|Extended|Core\b/);

    const topicHtml = renderToStaticMarkup(<>{await topicRoute.default(topic)}</>);
    expect(topicHtml).toContain("IB Chemistry notes");
    expect(topicHtml).toContain(" › Structure 1");
    expect(topicHtml).toContain(">STRUCTURE 1</div>");
    expect(topicHtml).toMatch(/\d+ SL · \d+ HL questions/);
    // The server renders the HL view (the level switch restores a saved SL choice on the client).
    expect(topicHtml).toContain(`href="/banks/ib-chemistry-hl?free=0&amp;subtopic=Particles%2C+states%2C+mixtures+and+separation"`);
    expect(topicHtml).toContain("past-paper questions in the Chemistry HL bank");
    expect(topicHtml).not.toMatch(/Maths|0580|Extended|Core\b/);

    const sheet = renderToStaticMarkup(<>{await cheatRoute.default()}</>);
    expect(sheet).toContain("Not affiliated with the IB.");
  });

  it("names the shared subtopic in a lesson's practise band, and sends an AHL lesson's SL view to the HL bank", () => {
    const band = (item: string, level: "SL" | "HL") => {
      window.localStorage.setItem("notes-level:ib-chemistry", level);
      resetPersistedStoresForTests();
      const practice = lessonPractice(course, item)!;
      const view = render(<CourseNotesProvider course={clientCourse(course)}><PractiseBand practice={practice} bankPrefix={course.copy.bankPrefix} /></CourseNotesProvider>);
      const link = view.container.querySelector("a");
      const out = { practice, text: view.container.querySelector("p")!.textContent, button: link?.textContent, href: link?.getAttribute("href") };
      cleanup();
      return out;
    };
    try {
      // 1.6 and 5.1 (both SL) share "The mole and reacting quantities".
      const sl = band("1.6", "SL");
      expect(sl.practice.name).toBe("The mole and reacting quantities");
      expect(sl.text).toBe(`${sl.practice.counts.base} past-paper questions on The mole and reacting quantities in the Chemistry SL bank, each with a mark scheme and a worked explanation.`);
      expect(sl.button).toBe("Practise The mole and reacting quantities →");
      expect(sl.href).toBe("/banks/ib-chemistry-sl?free=0&subtopic=The+mole+and+reacting+quantities");
      expect(lessonPractice(course, "5.1")!.hrefs).toEqual(sl.practice.hrefs);
      const hl = band("1.6", "HL");
      expect(hl.text).toBe(`${hl.practice.counts.extension} past-paper questions on The mole and reacting quantities in the Chemistry HL bank, each with a mark scheme and a worked explanation.`);
      expect(hl.href).toBe("/banks/ib-chemistry-hl?free=0&subtopic=The+mole+and+reacting+quantities");

      // 1.5 is AHL: its SL view says so and points at the HL bank.
      const ahl = band("1.5", "SL");
      expect(ahl.practice.counts.base).toBe(0);
      expect(ahl.text).toBe(`1.5 is HL only. ${ahl.practice.counts.extension} past-paper questions on Electron configurations and emission spectra in the Chemistry HL bank, each with a mark scheme and a worked explanation.`);
      expect(ahl.href).toBe("/banks/ib-chemistry-hl?free=0&subtopic=Electron+configurations+and+emission+spectra");
    } finally {
      window.localStorage.clear();
      resetPersistedStoresForTests();
    }
  });

  it("renders a lesson page with its practise band (a stand-in lesson until the first is written)", async () => {
    process.env.NOTES_PREVIEW = "1";
    const restore = course.lessons.length ? () => {} : setCourseLessonsForTests(course.slug, { ...lessonFixture, sections: [{ id: "s", heading: "Water", blocks: [{ type: "text", text: "$\\ce{2H2(g) + O2(g) -> 2H2O(l)}$" }] }], before: [] }, ["1.6"]);
    try {
      const lesson = course.lessons[0];
      const html = renderToStaticMarkup(<>{await lessonRoute.default({ params: Promise.resolve(lessonParams(lessonPath(course, lesson))) })}</>);
      expect(html).toContain('"educationalLevel":"IB Diploma"');
      expect(html).toContain(lessonPractice(course, lesson.item)!.hrefs.extension.replace(/&/g, "&amp;"));
      expect(html).not.toMatch(/katex-error|Maths|0580/);
    } finally {
      restore();
    }
  });
});
