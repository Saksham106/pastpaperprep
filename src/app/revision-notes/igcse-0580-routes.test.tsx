// The IGCSE Maths 0580 course: the same thin route wrappers as AA, hidden until published, with its own labels.
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

import { getCourse, lessonPath } from "@/lib/course-notes/course";
import { notesPaths } from "@/lib/revision-notes";
import * as homeRoute from "./igcse-maths-0580/page";
import * as topicRoute from "./igcse-maths-0580/[topic]/page";
import * as lessonRoute from "./igcse-maths-0580/[topic]/[lesson]/page";
import * as cheatRoute from "./igcse-maths-0580/cheat-sheet/page";
import * as topicCheatRoute from "./igcse-maths-0580/[topic]/cheat-sheet/page";
import * as glossaryRoute from "./igcse-maths-0580/glossary/page";
import * as commandRoute from "./igcse-maths-0580/command-terms/page";

const course = getCourse("igcse-maths-0580")!;
const lesson = course.lessons[0];
const [, , , topicSlug, lessonSlug] = lessonPath(course, lesson).split("/");
const topic = { params: Promise.resolve({ topic: topicSlug }) };
const lessonParams = { params: Promise.resolve({ topic: topicSlug, lesson: lessonSlug }) };
const staticRoutes = [homeRoute, cheatRoute, glossaryRoute, commandRoute];
const topicRoutes = [topicRoute, topicCheatRoute];

let saved: string | undefined;
beforeEach(() => { saved = process.env.NOTES_PREVIEW; delete process.env.NOTES_PREVIEW; });
afterEach(() => { if (saved === undefined) delete process.env.NOTES_PREVIEW; else process.env.NOTES_PREVIEW = saved; });

describe("IGCSE Maths 0580 course routes", () => {
  it("is unpublished: no params, every page 404s, nothing in the sitemap", async () => {
    expect(course.published).toBe(false);
    for (const route of [...staticRoutes, ...topicRoutes, lessonRoute]) {
      expect(route.dynamicParams).toBe(false);
      expect(await route.generateStaticParams()).toEqual([]);
    }
    for (const route of staticRoutes) await expect(route.default()).rejects.toThrow();
    for (const route of topicRoutes) await expect(route.default(topic)).rejects.toThrow();
    await expect(lessonRoute.default(lessonParams)).rejects.toThrow();
    expect(notesPaths().some((path) => path.includes(course.slug))).toBe(false);
  });

  it("emits its params and sitemap paths with NOTES_PREVIEW=1", async () => {
    process.env.NOTES_PREVIEW = "1";
    for (const route of [homeRoute, cheatRoute]) expect(await route.generateStaticParams()).toEqual([{}]);
    // No glossary terms or command terms yet, so no empty pages in the sitemap.
    expect(course.glossary).toHaveLength(0);
    expect(course.commandTerms).toHaveLength(0);
    for (const route of [glossaryRoute, commandRoute]) expect(await route.generateStaticParams()).toEqual([]);
    expect(notesPaths().some((path) => path.endsWith("/glossary") && path.includes(course.slug))).toBe(false);
    for (const route of topicRoutes) expect(await route.generateStaticParams()).toEqual(course.topics.map((entry) => ({ topic: entry.slug })));
    expect(await lessonRoute.generateStaticParams()).toEqual([{ topic: topicSlug, lesson: lessonSlug }]);
    expect(notesPaths()).toContain(lessonPath(course, lesson));
    const meta = await lessonRoute.generateMetadata(lessonParams);
    expect(meta.alternates?.canonical).toBe(lessonPath(course, lesson));
    expect((await commandRoute.generateMetadata()).description).toBe("What each Cambridge command term asks you to do in IGCSE Maths 0580 exams.");
  });

  it("renders every page with the course's own labels, crumbs and practice links", async () => {
    process.env.NOTES_PREVIEW = "1";
    const home = renderToStaticMarkup(<>{await homeRoute.default()}</>);
    expect(home).toContain("› IGCSE › Maths 0580");
    expect(home).toContain(">Core</button>");
    expect(home).toContain(">Extended</button>");
    expect(home).toContain("● CORE AND EXTENDED");
    expect(home).toContain("◆ EXTENDED ONLY");
    expect(home).toContain('data-view="Extended"');
    expect(home).not.toMatch(/\bHL\b|\bSL\b|IB Maths/);

    const topicHtml = renderToStaticMarkup(<>{await topicRoute.default(topic)}</>);
    expect(topicHtml).toContain("IGCSE Maths 0580 notes");
    expect(topicHtml).toContain("/banks/igcse?officialCode=current_2025%3AE1.1");
    expect(topicHtml).toMatch(/\d+ Core · \d+ Extended questions/);
    expect(topicHtml).toContain("◆ Extended</span>");
    expect(topicHtml).not.toMatch(/\bHL\b|\bSL\b/);

    const lessonHtml = renderToStaticMarkup(<>{await lessonRoute.default(lessonParams)}</>);
    expect(lessonHtml).toContain("1.1 · Core");
    expect(lessonHtml).toContain('"educationalLevel":"Cambridge IGCSE"');
    expect(lessonHtml).toMatch(/in the 0580 (<!-- -->)?Extended(<!-- -->)? bank/);
    expect(lessonHtml).toContain('href="/banks/igcse?officialCode=current_2025%3AE1.1"');
    expect(lessonHtml).not.toMatch(/\bHL\b|\bSL\b|\bAHL\b/);

    const sheet = renderToStaticMarkup(<>{await cheatRoute.default()}</>);
    expect(sheet).toContain("IGCSE MATHS 0580 · ");
    expect(sheet).toContain("Not affiliated with Cambridge.");
    expect(renderToStaticMarkup(<>{await topicCheatRoute.default(topic)}</>)).toContain("Number cheat sheet");
    expect(renderToStaticMarkup(<>{await glossaryRoute.default()}</>)).toContain("No terms yet.");
    expect(renderToStaticMarkup(<>{await commandRoute.default()}</>)).toContain("Command terms are coming soon.");
  });
});
