import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getCourse, type Course } from "@/lib/course-notes/course";
import { lessonFixture } from "@/lib/course-notes/__fixtures__/lesson";
import type { Block, Lesson } from "@/lib/course-notes/types";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));

import { CheatSheet } from "./CheatSheet";
import { PRINT_CSS } from "./CheatSheetFrame";

const base = getCourse("ib-math-aa") as Course;
const sheetBlocks = (...blocks: Block[]): Lesson["sections"] => [{ id: "s", heading: "S", blocks: [{ type: "text", text: "Not on the sheet." }, ...blocks] }];
const make = (item: string, topic: Lesson["topic"], level: Lesson["level"], title: string, slug: string, sections: Lesson["sections"]): Lesson => ({ ...lessonFixture, item, topic, level, title, slug, sections });

const course: Course = {
  ...base,
  lessons: [
    make("5.3", 5, "SL", "Differentiating powers", "powers", sheetBlocks({ type: "formula", tex: "f'(x)=nx^{n-1}", tag: "booklet", cheatSheet: true }, { type: "formula", tex: "hidden=1", tag: "learn" })),
    make("5.2", 5, "SL", "Increasing and decreasing", "inc-dec", sheetBlocks({ type: "fact", text: "$f'(x)>0$: increasing.", tag: "learn", cheatSheet: true })),
    make("5.16", 5, "AHL", "By parts", "by-parts", sheetBlocks({ type: "formula", tex: "\\int u\\,dv=uv-\\int v\\,du", tag: "booklet", cheatSheet: true })),
    make("5.4", 5, "SL", "No sheet rows", "none", sheetBlocks({ type: "formula", tex: "skip=1", tag: "learn" })),
    make("2.5", 2, "SL", "Quadratics", "quadratics", sheetBlocks({ type: "formula", tex: "\\Delta=b^2-4ac", tag: "learn", cheatSheet: true })),
  ].sort((a, b) => a.topic - b.topic || a.item.localeCompare(b.item, "en", { numeric: true })),
};
const calculus = course.topics.find((topic) => topic.n === 5)!;
const items = () => [...document.querySelectorAll("[data-block]")].map((el) => el.getAttribute("data-block"));

beforeEach(() => {
  window.localStorage.clear();
  track.mockClear();
});
afterEach(cleanup);

describe("CheatSheet", () => {
  it("lists cheat-sheet formula and fact blocks in syllabus order, each heading linking its lesson", () => {
    render(<CheatSheet course={course} topic={calculus} />);
    expect(items().filter((item) => item !== "method")).toEqual(["5.2", "5.3", "5.16"]);
    expect(screen.getByRole("link", { name: /5\.3 Differentiating powers/ }).getAttribute("href")).toMatch(/\/calculus\/5-3-powers$/);
    expect(document.body.textContent).not.toContain("hidden=1");
    expect(document.querySelector('[data-block="5.4"]')).toBeNull();
    expect(document.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("BOOKLET").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LEARN").length).toBeGreaterThan(0);
  });

  it("marks AHL blocks with a diamond and a data flag; the SL switch hides them by CSS and keeps the HTML complete", async () => {
    render(<CheatSheet course={course} topic={calculus} />);
    const ahl = document.querySelector('[data-block="5.16"]') as HTMLElement;
    expect(ahl.hasAttribute("data-ahl")).toBe(true);
    expect(ahl.textContent).toContain("5.16 ◆");
    expect(document.querySelector('[data-block="5.3"]')!.hasAttribute("data-ahl")).toBe(false);
    const sheet = document.querySelector("[data-sheet]") as HTMLElement;
    expect(sheet.getAttribute("data-level")).toBe("HL");
    expect(screen.getByText(/IB MATHS AA · HL/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "SL" }));
    expect(sheet.getAttribute("data-level")).toBe("SL");
    expect(screen.getByText(/IB MATHS AA · SL/)).toBeTruthy();
    expect(document.querySelector('[data-block="5.16"]')).toBe(ahl);
    const css = readFileSync(join(process.cwd(), "src/components/course-notes/cheatsheet.module.css"), "utf8");
    expect(css).toMatch(/\.sheet\[data-level="SL"\] \[data-ahl\][^{]*\{\s*display:\s*none/);
  });

  it("adds sheet-only lines as a Which method when block, split by level, from the content index", () => {
    render(<CheatSheet course={{ ...course, cheatSheets: { calculus: { lines: [
      { text: "Use $f'(x)=0$ for a stationary point.", tag: "learn", level: "SL" },
      { text: "Try parts for a product.", tag: "learn", level: "AHL" },
    ] } } }} topic={calculus} />);
    const methods = [...document.querySelectorAll('[data-block="method"]')];
    expect(methods).toHaveLength(2);
    expect(methods[0].hasAttribute("data-ahl")).toBe(false);
    expect(methods[1].hasAttribute("data-ahl")).toBe(true);
    expect(methods[0].textContent).toContain("Which method when");
    expect(items().at(-1)).toBe("method");
  });

  it("builds the course sheet as the union of the topic sheets, with topic headings", () => {
    const topicItems = course.topics.flatMap((topic) => {
      const { unmount } = render(<CheatSheet course={course} topic={topic} />);
      const found = items();
      unmount();
      return found;
    });
    render(<CheatSheet course={course} />);
    expect(items()).toEqual(topicItems);
    expect(document.querySelectorAll("[data-topic]").length).toBe(2);
    expect(screen.getByRole("link", { name: /5 Calculus/ }).getAttribute("href")).toBe("/revision-notes/ib-math-aa/calculus");
  });

  it("hides a topic heading in the SL view when every block under it is AHL", () => {
    const ahlOnly: Course = { ...course, lessons: [...course.lessons.filter((l) => l.topic !== 5), make("5.16", 5, "AHL", "By parts", "by-parts", sheetBlocks({ type: "formula", tex: "x=1", tag: "learn", cheatSheet: true }))] };
    render(<CheatSheet course={ahlOnly} />);
    const heading = (n: number) => document.querySelector(`[data-topic="${n}"] h3`)!;
    expect(heading(5).hasAttribute("data-all-ahl")).toBe(true);
    expect(heading(2).hasAttribute("data-all-ahl")).toBe(false);
    const css = readFileSync(join(process.cwd(), "src/components/course-notes/cheatsheet.module.css"), "utf8");
    expect(css).toMatch(/\.sheet\[data-level="SL"\] \[data-all-ahl\]/);
  });

  it("shows the header, footer and the print stylesheet hides the site chrome on A4", () => {
    render(<CheatSheet course={course} topic={calculus} />);
    expect(screen.getByText("pastpaperprep.com/revision-notes")).toBeTruthy();
    expect(screen.getByText("Follows the IB Maths AA guide (first assessment 2021). Not affiliated with the IB.")).toBeTruthy();
    expect(document.querySelector("style[data-print-css]")!.textContent).toBe(PRINT_CSS);
    expect(PRINT_CSS).toContain("@media print");
    expect(PRINT_CSS).toContain("size: A4");
    expect(PRINT_CSS).toContain("margin: 12mm");
    expect(PRINT_CSS).toMatch(/\.site-header[^{]*\.site-footer[^{]*\{\s*display: none/);
    expect(document.body.textContent).not.toMatch(/official/i);
  });

  it("Save as PDF prints and tracks the topic and level", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    render(<CheatSheet course={course} topic={calculus} />);
    await userEvent.click(screen.getByRole("button", { name: "SL" }));
    await userEvent.click(screen.getByRole("button", { name: "Save as PDF" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("notes_cheatsheet_print", { topic: "calculus", level: "SL" });
    cleanup();
    render(<CheatSheet course={course} />);
    await userEvent.click(screen.getByRole("button", { name: "Save as PDF" }));
    expect(track).toHaveBeenLastCalledWith("notes_cheatsheet_print", { topic: "course", level: "SL" });
    vi.unstubAllGlobals();
  });
});
