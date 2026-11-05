import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientCourse } from "@/lib/course-notes/client-course";
import { getCourse, type Course } from "@/lib/course-notes/course";
import { sheetTopics } from "@/lib/course-notes/cheatsheet";
import type { Block, CalculatorSnippets, Lesson } from "@/lib/course-notes/types";

vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));

import { Blocks } from "./Blocks";
import { CalculatorSteps } from "./CalculatorSteps";
import { CheatSheet } from "./CheatSheet";
import { LessonPage } from "./LessonPage";
import { CourseNotesProvider } from "./notes-context";
import { resetPersistedStoresForTests } from "./persisted-store";

const igcse = getCourse("igcse-maths-0580") as Course;
const snippets: CalculatorSnippets = {
  "hcf-gcd": { title: "HCF", steps: { "casio-classwiz": ["Press ALPHA, GCD, type {a} , {b}, press ="], "ti-30xs": ["Press math, NUM, gcd(, type {a} , {b}, press enter"] } },
};
const css = readFileSync(join(process.cwd(), "src/components/course-notes/course-notes.module.css"), "utf8");
const inProvider = (node: React.ReactNode, course: Course = igcse) => <CourseNotesProvider course={clientCourse(course)}>{node}</CourseNotesProvider>;

beforeEach(() => {
  window.localStorage.clear();
  resetPersistedStoresForTests();
});
afterEach(cleanup);

describe("calculator blocks per course", () => {
  it("shows the course's calculator models and keeps 0580's choice under its own key", async () => {
    const user = userEvent.setup();
    render(inProvider(<CalculatorSteps steps={{ "casio-classwiz": [<span key="c">casio keys</span>], "ti-30xs": [<span key="t">ti keys</span>] }} />));
    expect(screen.getByRole("button", { name: "Casio fx-991EX / fx-83GTX / fx-85GTX ClassWiz" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("casio keys")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "TI-30XS MultiView" }));
    expect(screen.getByText("ti keys")).toBeTruthy();
    expect(window.localStorage.getItem("notes-calc:igcse-maths-0580")).toBe("ti-30xs");
    expect(window.localStorage.getItem("notes-calc")).toBeNull();
  });

  it("renders a snippet block with its placeholders filled", () => {
    const block: Block = { type: "calculator", snippet: "hcf-gcd", values: { a: 24, b: 36 } };
    render(inProvider(<Blocks blocks={[block]} glossary={[]} lessonHref={() => "#"} calculatorSnippets={snippets} />));
    expect(screen.getByText("Press ALPHA, GCD, type 24 , 36, press =")).toBeTruthy();
  });
});

describe("extension content inside a base lesson", () => {
  const lesson: Lesson = {
    ...igcse.lessons.find((entry) => entry.item === "1.1")!,
    goals: [{ text: "Find the HCF.", bullets: [] }, { text: "Convert recurring decimals.", bullets: [], level: "Extended" }],
    sections: [
      { id: "core", heading: "Core part", blocks: [{ type: "text", text: "Core words." }, { type: "text", text: "Extended aside.", level: "Extended" }, { type: "calculator", snippet: "hcf-gcd", values: { a: 24, b: 36 } }] },
      { id: "ext", heading: "Recurring decimals", level: "Extended", blocks: [{ type: "text", text: "Extended section words." }] },
      { id: "takeaways", heading: "Key takeaways", blocks: [{ type: "fact", text: "Core fact.", tag: "learn", cheatSheet: true }, { type: "formula", tex: "0.\\dot{3}=\\tfrac13", tag: "learn", cheatSheet: true, level: "Extended" }] },
    ],
  };
  const course: Course = { ...igcse, lessons: [lesson], cheatSheets: {}, calculatorSnippets: snippets };

  it("marks Extended sections, blocks, goals, rail entries and takeaways with data-ext, and badges Extended headings", () => {
    const { container } = render(inProvider(<LessonPage course={course} lesson={lesson} />, course));
    const section = container.querySelector("#s-ext") as HTMLElement;
    expect(section.hasAttribute("data-ext")).toBe(true);
    expect(within(section).getByRole("heading", { level: 2 }).textContent).toBe("Recurring decimals Extended only");
    expect(container.querySelector("#s-core")!.hasAttribute("data-ext")).toBe(false);
    expect(screen.getByText("Extended aside.").closest("[data-ext]")).toBeTruthy();
    expect(screen.getByText("Core words.").closest("[data-ext]")).toBeNull();
    expect(screen.getByText("Convert recurring decimals.").closest("li")!.hasAttribute("data-ext")).toBe(true);
    expect(screen.getByText("Find the HCF.").closest("li")!.hasAttribute("data-ext")).toBe(false);
    const railLinks = [...container.querySelectorAll('nav[aria-label="On this page"] a')].filter((a) => a.getAttribute("href") === "#s-ext");
    expect(railLinks[0].closest("li")!.hasAttribute("data-ext")).toBe(true);
    const takeaways = container.querySelector("#takeaways") as HTMLElement;
    expect(takeaways.hasAttribute("data-ext")).toBe(false);
    expect(takeaways.querySelectorAll("[data-ext]").length).toBe(1);
    expect(screen.getByText("Press ALPHA, GCD, type 24 , 36, press =")).toBeTruthy();
  });

  it("hides data-ext in the base view by CSS (the HTML stays complete)", () => {
    expect(css).toMatch(/\.lessonPage\[data-base-view\] \[data-ext\] \{ display: none; \}/);
  });

  it("hides an Extended formula of a Core lesson from the Core cheat sheet only", () => {
    const [topic] = sheetTopics(course, course.topics[0]);
    expect(topic.blocks[0].rows.map((row) => [row.value, row.extension ?? false])).toEqual([["Core fact.", false], ["0.\\dot{3}=\\tfrac13", true]]);
    const { container } = render(<CheatSheet course={course} topic={course.topics[0]} />);
    expect([...container.querySelectorAll("[data-row]")].map((row) => row.hasAttribute("data-ahl"))).toEqual([false, true]);
  });

  it("shows a Core lesson whose sheet rows are all Extended as an Extended block", () => {
    const allExtended: Lesson = { ...lesson, sections: [{ id: "t", heading: "T", level: "Extended", blocks: [{ type: "fact", text: "Only Extended.", tag: "learn", cheatSheet: true }] }] };
    const [topic] = sheetTopics({ ...course, lessons: [allExtended] }, course.topics[0]);
    expect(topic.blocks[0]).toMatchObject({ level: "Extended", rows: [{ value: "Only Extended." }] });
    expect(topic.blocks[0].rows[0].extension).toBeUndefined();
    expect(topic.allAhl).toBe(true);
  });
});
