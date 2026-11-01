import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { COURSES, lessonPath } from "@/lib/course-notes/course";
import { notesPaths } from "@/lib/revision-notes";
import * as subjectPage from "./[subject]/page";
import * as topicPage from "./[subject]/[topic]/page";
import * as lessonPageRoute from "./[subject]/[topic]/[lesson]/page";
import * as cheatRoute from "./[subject]/cheat-sheet/page";
import * as topicCheatRoute from "./[subject]/[topic]/cheat-sheet/page";
import * as glossaryRoute from "./[subject]/glossary/page";
import * as commandRoute from "./[subject]/command-terms/page";
import { JsonLd } from "@/components/JsonLd";

const course = COURSES[0];
const lesson = course.lessons[0];
const topic = course.topics[0];
let saved: string | undefined;
beforeEach(() => { saved = process.env.NOTES_PREVIEW; });
afterEach(() => { if (saved === undefined) delete process.env.NOTES_PREVIEW; else process.env.NOTES_PREVIEW = saved; });

const find = (node: ReactNode, test: (el: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>>[] => {
  if (Array.isArray(node)) return node.flatMap((child) => find(child, test));
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<Record<string, unknown>>;
  return [...(test(el) ? [el] : []), ...find(el.props.children as ReactNode, test)];
};
const jsonLdTypes = (page: ReactNode) =>
  find(page, (el) => el.type === JsonLd).map((el) => (el.props.data as { "@type": string })["@type"]);

describe("course routes", () => {
  it("emits no course params unless the course is visible, and keeps 0620", async () => {
    delete process.env.NOTES_PREVIEW;
    expect(await subjectPage.generateStaticParams()).toEqual([{ subject: "igcse-chemistry-0620" }]);
    expect(await topicPage.generateStaticParams()).toEqual(expect.not.arrayContaining([{ subject: course.slug, topic: topic.slug }]));
    expect(await lessonPageRoute.generateStaticParams()).toEqual([]);
    for (const route of [cheatRoute, glossaryRoute, commandRoute, topicCheatRoute]) expect(await route.generateStaticParams()).toEqual([]);
  });

  it("emits course, topic and lesson params with NOTES_PREVIEW=1; static segments are course-only", async () => {
    process.env.NOTES_PREVIEW = "1";
    expect(await subjectPage.generateStaticParams()).toContainEqual({ subject: course.slug });
    const topics = await topicPage.generateStaticParams();
    for (const t of course.topics) expect(topics).toContainEqual({ subject: course.slug, topic: t.slug });
    expect(topics.filter((p) => p.subject === "igcse-chemistry-0620")).toHaveLength(12);
    const lessons = await lessonPageRoute.generateStaticParams();
    expect(lessons).toHaveLength(course.lessons.length);
    expect(lessons).toContainEqual({ subject: course.slug, topic: lessonPath(course, lesson).split("/")[3], lesson: lessonPath(course, lesson).split("/").pop() });
    for (const route of [cheatRoute, glossaryRoute, commandRoute]) {
      expect(await route.generateStaticParams()).toEqual([{ subject: course.slug }]);
      expect(route.dynamicParams).toBe(false);
    }
    expect(await topicCheatRoute.generateStaticParams()).toHaveLength(course.topics.length);
    for (const route of [subjectPage, topicPage, lessonPageRoute, topicCheatRoute]) expect(route.dynamicParams).toBe(false);
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
    const s = { subject: course.slug };
    await check(await subjectPage.generateMetadata({ params: Promise.resolve(s) }), base);
    for (const t of course.topics) {
      await check(await topicPage.generateMetadata({ params: Promise.resolve({ ...s, topic: t.slug }) }), `${base}/${t.slug}`);
      await check(await topicCheatRoute.generateMetadata({ params: Promise.resolve({ ...s, topic: t.slug }) }), `${base}/${t.slug}/cheat-sheet`);
    }
    for (const l of course.lessons) {
      const path = lessonPath(course, l);
      await check(await lessonPageRoute.generateMetadata({ params: Promise.resolve({ ...s, topic: path.split("/")[3], lesson: path.split("/")[4] }) }), path);
    }
    await check(await cheatRoute.generateMetadata({ params: Promise.resolve(s) }), `${base}/cheat-sheet`);
    await check(await glossaryRoute.generateMetadata({ params: Promise.resolve(s) }), `${base}/glossary`);
    await check(await commandRoute.generateMetadata({ params: Promise.resolve(s) }), `${base}/command-terms`);
  });

  it("404s the course-only segments for 0620", async () => {
    process.env.NOTES_PREVIEW = "1";
    for (const route of [cheatRoute, glossaryRoute, commandRoute]) {
      expect(await route.generateStaticParams()).not.toContainEqual({ subject: "igcse-chemistry-0620" });
      expect(route.dynamicParams).toBe(false);
    }
    await expect(cheatRoute.default({ params: Promise.resolve({ subject: "igcse-chemistry-0620" }) })).rejects.toThrow();
  });

  it("emits Course JSON-LD on the home and LearningResource on lessons", async () => {
    process.env.NOTES_PREVIEW = "1";
    const home = await subjectPage.default({ params: Promise.resolve({ subject: course.slug }) });
    expect(jsonLdTypes(home)).toContain("Course");
    const path = lessonPath(course, lesson).split("/");
    const page = await lessonPageRoute.default({ params: Promise.resolve({ subject: course.slug, topic: path[3], lesson: path[4] }) });
    expect(jsonLdTypes(page)).toContain("LearningResource");
  });

  it("leaves the unpublished course out of the sitemap", () => {
    delete process.env.NOTES_PREVIEW;
    expect(notesPaths().some((p) => p.includes(course.slug))).toBe(false);
    process.env.NOTES_PREVIEW = "1";
    expect(notesPaths()).toContain(`/revision-notes/${course.slug}`);
  });

  it("still renders 0620 pages", async () => {
    const page = await subjectPage.default({ params: Promise.resolve({ subject: "igcse-chemistry-0620" }) });
    expect(isValidElement(page)).toBe(true);
  });
});
