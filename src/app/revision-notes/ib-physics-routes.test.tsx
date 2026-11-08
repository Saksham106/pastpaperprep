// The IB Physics course: the same thin route wrappers as IB Chemistry, hidden until published, practising by bank subtopic.
// Data-derived: it holds with no lessons written (as at the start) and with all 68.
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
import * as homeRoute from "./ib-physics/page";
import * as topicRoute from "./ib-physics/[topic]/page";
import * as lessonRoute from "./ib-physics/[topic]/[lesson]/page";
import * as cheatRoute from "./ib-physics/cheat-sheet/page";
import * as topicCheatRoute from "./ib-physics/[topic]/cheat-sheet/page";
import * as glossaryRoute from "./ib-physics/glossary/page";
import * as commandRoute from "./ib-physics/command-terms/page";

const course = getCourse("ib-physics")!;
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

describe("IB Physics course routes", () => {
  it("ships unpublished, with all 68 items", () => {
    expect(course.published).toBe(false);
    expect(course.items.items).toHaveLength(68);
    expect(course.lessons.length).toBeLessThanOrEqual(68);
  });

  it("when unpublished: no params, every page 404s, nothing in the sitemap, no site links", async () => {
    const restore = setCoursePublishedForTests(false, "ib-physics");
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
    expect(paths).toContain("/revision-notes/ib-physics");
    for (const entry of course.topics) expect(paths).toContain(topicPath(course, entry.n));
    for (const lesson of course.lessons) expect(paths).toContain(lessonPath(course, lesson));
    expect(paths.includes("/revision-notes/ib-physics/glossary")).toBe(course.glossary.length > 0);
    expect(paths.includes("/revision-notes/ib-physics/command-terms")).toBe(course.commandTerms.length > 0);
    expect((await homeRoute.generateMetadata()).alternates?.canonical).toBe("/revision-notes/ib-physics");
  });

  it("renders the home and topic pages with its own labels, theme names and subtopic practice links", async () => {
    process.env.NOTES_PREVIEW = "1";
    const home = renderToStaticMarkup(<>{await homeRoute.default()}</>);
    expect(home).toContain("› IB › Physics");
    expect(home).toContain("Follows the IB Physics guide for exams from May 2025.");
    expect(home).toContain(">SL</button>");
    expect(home).toContain(">HL</button>");
    expect(home).toContain("THEME A");
    expect(home).toContain("THEME E");
    expect(home).toContain(">TOPIC 6</div>");
    expect(home).not.toMatch(/Maths|0580|Chemistry|Extended|Core\b/);

    const topicHtml = renderToStaticMarkup(<>{await topicRoute.default(topic)}</>);
    expect(topicHtml).toContain("IB Physics notes");
    expect(topicHtml).toContain(" › Theme A");
    expect(topicHtml).toContain(">THEME A</div>");
    expect(topicHtml).toMatch(/\d+ SL · \d+ HL questions/);
    // The server renders the HL view (the level switch restores a saved SL choice on the client).
    expect(topicHtml).toContain(`href="/banks/ib-physics-hl?free=0&amp;subtopic=Kinematics+and+motion"`);
    expect(topicHtml).toContain("past-paper questions in the Physics HL bank");
    expect(topicHtml).not.toMatch(/Maths|0580|Chemistry|Extended|Core\b/);

    const sheet = renderToStaticMarkup(<>{await cheatRoute.default()}</>);
    expect(sheet).toContain("Not affiliated with the IB.");
  });

  it("names the shared subtopic in a lesson's practise band, and sends an AHL lesson's SL view to the HL bank", () => {
    const band = (item: string, level: "SL" | "HL") => {
      window.localStorage.setItem("notes-level:ib-physics", level);
      resetPersistedStoresForTests();
      const practice = lessonPractice(course, item)!;
      const view = render(<CourseNotesProvider course={clientCourse(course)}><PractiseBand practice={practice} bankPrefix={course.copy.bankPrefix} /></CourseNotesProvider>);
      const link = view.container.querySelector("a");
      const out = { practice, text: view.container.querySelector("p")!.textContent, button: link?.textContent, href: link?.getAttribute("href") };
      cleanup();
      return out;
    };
    try {
      // 1.8 and 4.1 (both SL) share "Circular motion and gravitation".
      const sl = band("1.8", "SL");
      expect(sl.practice.name).toBe("Circular motion and gravitation");
      expect(sl.text).toBe(`${sl.practice.counts.base} past-paper questions on Circular motion and gravitation in the Physics SL bank, each with a mark scheme and a worked explanation.`);
      expect(sl.button).toBe("Practise Circular motion and gravitation →");
      expect(sl.href).toBe("/banks/ib-physics-sl?free=0&subtopic=Circular+motion+and+gravitation");
      expect(lessonPractice(course, "4.1")!.hrefs).toEqual(sl.practice.hrefs);
      const hl = band("1.8", "HL");
      expect(hl.text).toBe(`${hl.practice.counts.extension} past-paper questions on Circular motion and gravitation in the Physics HL bank, each with a mark scheme and a worked explanation.`);
      expect(hl.href).toBe("/banks/ib-physics-hl?free=0&subtopic=Circular+motion+and+gravitation");

      // 1.12 is AHL: its SL view says so and points at the HL bank.
      const ahl = band("1.12", "SL");
      expect(ahl.practice.counts.base).toBe(0);
      expect(ahl.text).toBe(`1.12 is HL only. ${ahl.practice.counts.extension} past-paper questions on Rigid body and rotational mechanics in the Physics HL bank, each with a mark scheme and a worked explanation.`);
      expect(ahl.href).toBe("/banks/ib-physics-hl?free=0&subtopic=Rigid+body+and+rotational+mechanics");
    } finally {
      window.localStorage.clear();
      resetPersistedStoresForTests();
    }
  });

  it("renders a lesson page with its practise band (a stand-in lesson until the first is written)", async () => {
    process.env.NOTES_PREVIEW = "1";
    const restore = course.lessons.length ? () => {} : setCourseLessonsForTests(course.slug, { ...lessonFixture, sections: [{ id: "s", heading: "Motion", blocks: [{ type: "text", text: "$v = u + at$ and $\\text{9.81 m s}^{-2}$" }] }], before: [] }, ["1.1"]);
    try {
      const lesson = course.lessons[0];
      const html = renderToStaticMarkup(<>{await lessonRoute.default({ params: Promise.resolve(lessonParams(lessonPath(course, lesson))) })}</>);
      expect(html).toContain('"educationalLevel":"IB Diploma"');
      expect(html).toContain(lessonPractice(course, lesson.item)!.hrefs.extension.replace(/&/g, "&amp;"));
      expect(html).not.toMatch(/katex-error|Maths|0580|Chemistry/);
    } finally {
      restore();
    }
  });
});
