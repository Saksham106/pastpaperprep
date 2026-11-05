// Freezes the live IB Maths AA pages: server HTML, metadata and sitemap paths must not change when the
// course-notes platform is refactored. A deliberate AA change updates these hashes (and says so in the PR).
// AA_SNAPSHOT_DUMP=<dir> writes each page's HTML there, for diffing before and after a refactor.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));
// next/link needs a mounted app router to server-render; a plain anchor keeps href and attributes.
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

import { coursePaths } from "@/lib/course-notes/course";
import { notesPaths } from "@/lib/revision-notes";
import * as homeRoute from "./ib-math-aa/page";
import * as topicRoute from "./ib-math-aa/[topic]/page";
import * as lessonRoute from "./ib-math-aa/[topic]/[lesson]/page";
import * as cheatRoute from "./ib-math-aa/cheat-sheet/page";
import * as topicCheatRoute from "./ib-math-aa/[topic]/cheat-sheet/page";
import * as glossaryRoute from "./ib-math-aa/glossary/page";
import * as commandRoute from "./ib-math-aa/command-terms/page";

const sha = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

function html(name: string, node: ReactNode): string {
  const markup = renderToStaticMarkup(<>{node}</>);
  const dump = process.env.AA_SNAPSHOT_DUMP;
  if (dump) {
    mkdirSync(dump, { recursive: true });
    writeFileSync(join(dump, `${name}.html`), markup.replace(/></g, ">\n<"));
  }
  return markup;
}

const topic = { params: Promise.resolve({ topic: "calculus" }) };
const lesson = { params: Promise.resolve({ topic: "calculus", lesson: "5-16-integration-by-substitution-and-parts" }) };

beforeEach(() => {
  window.localStorage.clear();
});

describe("live AA pages are unchanged", () => {
  it("course home, topic, lesson, cheat sheets, glossary and command terms render the same HTML", async () => {
    const pages: Record<string, string> = {
      home: html("home", await homeRoute.default()),
      topic: html("topic", await topicRoute.default(topic)),
      lesson: html("lesson", await lessonRoute.default(lesson)),
      cheatSheet: html("cheat-sheet", await cheatRoute.default()),
      topicCheatSheet: html("topic-cheat-sheet", await topicCheatRoute.default(topic)),
      glossary: html("glossary", await glossaryRoute.default()),
      commandTerms: html("command-terms", await commandRoute.default()),
    };
    expect(Object.fromEntries(Object.entries(pages).map(([name, markup]) => [name, `${markup.length}:${sha(markup)}`]))).toMatchSnapshot();
  });

  it("metadata is the same", async () => {
    expect({
      home: await homeRoute.generateMetadata(),
      topic: await topicRoute.generateMetadata(topic),
      lesson: await lessonRoute.generateMetadata(lesson),
      cheatSheet: await cheatRoute.generateMetadata(),
      topicCheatSheet: await topicCheatRoute.generateMetadata(topic),
      glossary: await glossaryRoute.generateMetadata(),
      commandTerms: await commandRoute.generateMetadata(),
    }).toMatchSnapshot();
  });

  it("static params and sitemap paths are the same", async () => {
    const aa = (paths: string[]) => paths.filter((path) => path.startsWith("/revision-notes/ib-math-aa"));
    expect({
      home: await homeRoute.generateStaticParams(),
      topics: await topicRoute.generateStaticParams(),
      lessons: sha(JSON.stringify(await lessonRoute.generateStaticParams())),
      coursePaths: sha(JSON.stringify(aa(coursePaths()))),
      sitemap: sha(JSON.stringify(aa(notesPaths()))),
      count: aa(coursePaths()).length,
    }).toMatchSnapshot();
  });
});
