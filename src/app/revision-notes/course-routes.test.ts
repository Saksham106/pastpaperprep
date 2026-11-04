import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { setCoursePublishedForTests } from "@/lib/course-notes/test-visibility";
import { COURSES, lessonPath } from "@/lib/course-notes/course";
import { notesPaths } from "@/lib/revision-notes";
import * as chemistryHome from "./[subject]/page";
import * as chemistryTopic from "./[subject]/[topic]/page";
import * as subjectPage from "./ib-math-aa/page";
import * as topicPage from "./ib-math-aa/[topic]/page";
import * as lessonPageRoute from "./ib-math-aa/[topic]/[lesson]/page";
import * as cheatRoute from "./ib-math-aa/cheat-sheet/page";
import * as topicCheatRoute from "./ib-math-aa/[topic]/cheat-sheet/page";
import * as glossaryRoute from "./ib-math-aa/glossary/page";
import * as commandRoute from "./ib-math-aa/command-terms/page";
import { JsonLd } from "@/components/JsonLd";

const course = COURSES[0];
const lesson = course.lessons[0];
const topic = course.topics[0];
let saved: string | undefined;
let restorePublished: (() => void) | undefined;
beforeEach(() => { saved = process.env.NOTES_PREVIEW; });
afterEach(() => {
  restorePublished?.();
  restorePublished = undefined;
  if (saved === undefined) delete process.env.NOTES_PREVIEW; else process.env.NOTES_PREVIEW = saved;
});
/** Hidden state: the course unpublished and no preview. */
const hide = () => { restorePublished ??= setCoursePublishedForTests(false); delete process.env.NOTES_PREVIEW; };

const find = (node: ReactNode, test: (el: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] => {
  if (Array.isArray(node)) return node.flatMap((child) => find(child, test));
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<Record<string, unknown>>;
  return [...(test(el) ? [el] : []), ...find(el.props.children as ReactNode, test)];
};
const jsonLdTypes = (page: ReactNode) =>
  find(page, (el) => el.type === JsonLd).map((el) => (el.props.data as { "@type": string })["@type"]);

const paramsOf = (path: string) => { const [, , , t, l] = path.split("/"); return { topic: t, lesson: l }; };
const staticRoutes = [subjectPage, cheatRoute, glossaryRoute, commandRoute];
const topicRoutes = [topicPage, topicCheatRoute];
const everyRoute = [...staticRoutes, ...topicRoutes, lessonPageRoute];

describe("course routes (own static tree under ib-math-aa)", () => {
  it("emits no params unless the course is visible, and leaves the [subject] routes as before", async () => {
    hide();
    for (const route of everyRoute) expect(await route.generateStaticParams(), "hidden").toEqual([]);
    expect(await chemistryHome.generateStaticParams()).toEqual([{ subject: "igcse-chemistry-0620" }]);
    expect((await chemistryTopic.generateStaticParams()).every((p) => p.subject === "igcse-chemistry-0620")).toBe(true);
  });

  it("emits params for the course, its topics and lessons with NOTES_PREVIEW=1", async () => {
    process.env.NOTES_PREVIEW = "1";
    for (const route of staticRoutes) expect(await route.generateStaticParams()).toEqual([{}]);
    for (const route of topicRoutes) expect(await route.generateStaticParams()).toEqual(course.topics.map((t) => ({ topic: t.slug })));
    const lessons = await lessonPageRoute.generateStaticParams();
    expect(lessons).toHaveLength(course.lessons.length);
    expect(lessons).toContainEqual(paramsOf(lessonPath(course, lesson)));
    expect((await chemistryHome.generateStaticParams()).some((p) => p.subject === course.slug)).toBe(false);
    expect((await chemistryTopic.generateStaticParams()).some((p) => p.subject === course.slug)).toBe(false);
  });

  it("is dynamicParams = false on every page", () => {
    for (const route of [...everyRoute, chemistryHome, chemistryTopic]) expect(route.dynamicParams).toBe(false);
  });

  it("404s every page while the course is hidden, and 404s unknown topics and lessons when visible", async () => {
    hide();
    const topicParams = { params: Promise.resolve({ topic: topic.slug }) };
    await expect(subjectPage.default()).rejects.toThrow();
    for (const route of [cheatRoute, glossaryRoute, commandRoute]) await expect(route.default()).rejects.toThrow();
    for (const route of topicRoutes) await expect(route.default(topicParams)).rejects.toThrow();
    await expect(lessonPageRoute.default({ params: Promise.resolve(paramsOf(lessonPath(course, lesson))) })).rejects.toThrow();
    process.env.NOTES_PREVIEW = "1";
    for (const route of topicRoutes) await expect(route.default({ params: Promise.resolve({ topic: "nope" }) })).rejects.toThrow();
    await expect(lessonPageRoute.default({ params: Promise.resolve({ topic: topic.slug, lesson: "nope" }) })).rejects.toThrow();
  });

  it("gives every page a canonical path and an absolute title of 60 characters or fewer", async () => {
    process.env.NOTES_PREVIEW = "1";
    const check = async (meta: Awaited<ReturnType<typeof subjectPage.generateMetadata>>, path: string) => {
      const title = (meta.title as { absolute: string }).absolute;
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThanOrEqual(60);
      expect(meta.alternates?.canonical).toBe(path);
    };
    const base = `/revision-notes/${course.slug}`;
    await check(await subjectPage.generateMetadata(), base);
    for (const t of course.topics) {
      await check(await topicPage.generateMetadata({ params: Promise.resolve({ topic: t.slug }) }), `${base}/${t.slug}`);
      await check(await topicCheatRoute.generateMetadata({ params: Promise.resolve({ topic: t.slug }) }), `${base}/${t.slug}/cheat-sheet`);
    }
    for (const l of course.lessons) {
      const path = lessonPath(course, l);
      await check(await lessonPageRoute.generateMetadata({ params: Promise.resolve(paramsOf(path)) }), path);
    }
    await check(await cheatRoute.generateMetadata(), `${base}/cheat-sheet`);
    await check(await glossaryRoute.generateMetadata(), `${base}/glossary`);
    await check(await commandRoute.generateMetadata(), `${base}/command-terms`);
  });

  it("emits Course JSON-LD (with a description) on the home and LearningResource on lessons", async () => {
    process.env.NOTES_PREVIEW = "1";
    const home = await subjectPage.default();
    expect(jsonLdTypes(home)).toContain("Course");
    const data = find(home, (el) => el.type === JsonLd)[0].props.data as { description?: string };
    expect(data.description?.length).toBeGreaterThan(20);
    const page = await lessonPageRoute.default({ params: Promise.resolve(paramsOf(lessonPath(course, lesson))) });
    expect(jsonLdTypes(page)).toContain("LearningResource");
  });

  it("leaves the unpublished course out of the sitemap", () => {
    hide();
    expect(notesPaths().some((p) => p.includes(course.slug))).toBe(false);
    expect(notesPaths().some((p) => /cheat-sheet|glossary|command-terms/.test(p) && p.includes("ib-math-aa"))).toBe(false);
    process.env.NOTES_PREVIEW = "1";
    expect(notesPaths()).toContain(`/revision-notes/${course.slug}`);
    for (const tail of ["cheat-sheet", "glossary", "command-terms", `${topic.slug}/cheat-sheet`]) expect(notesPaths()).toContain(`/revision-notes/${course.slug}/${tail}`);
  });

  it("still renders 0620 pages", async () => {
    const page = await chemistryHome.default({ params: Promise.resolve({ subject: "igcse-chemistry-0620" }) });
    expect(isValidElement(page)).toBe(true);
  });
});
