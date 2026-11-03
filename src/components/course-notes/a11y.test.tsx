import { readFileSync } from "node:fs";
import { join } from "node:path";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getCourse, type Course } from "@/lib/course-notes/course";
import { lessonFixture } from "@/lib/course-notes/__fixtures__/lesson";
import type { Block, Lesson } from "@/lib/course-notes/types";
import { resetPersistedStoresForTests } from "./persisted-store";

const push = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { Blocks } from "./Blocks";
import { CheatSheet } from "./CheatSheet";
import { CheckQuestion } from "./CheckQuestion";
import { ExampleSteps } from "./ExampleSteps";
import { GlossaryIndex } from "./GlossaryIndex";
import { LessonPage } from "./LessonPage";
import { LessonSearch, type HomeItem } from "./LessonSearch";
import EulerStep from "./interactives/EulerStep";
import { Slider } from "./interactives/shared";

const base = getCourse("ib-math-aa") as Course;
const make = (item: string, topic: Lesson["topic"], level: Lesson["level"], title: string, slug: string, sections: Lesson["sections"] = lessonFixture.sections): Lesson => ({ ...lessonFixture, item, topic, level, title, slug, sections });
const violations = async (container: Element, rules: string[]) => (await axe.run(container, { runOnly: rules })).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
const lessonHref = (item: string) => `/lesson/${item}`;

beforeEach(() => {
  window.localStorage.clear();
  resetPersistedStoresForTests();
  push.mockClear();
});
afterEach(cleanup);

describe("worked-example landmarks", () => {
  const blocks: Block[] = [
    { type: "example", id: "ex-one", question: "Differentiate $x^2$.", steps: ["a", "b"], answer: "$2x$", video: null },
    { type: "example", id: "ex-two", question: "Differentiate $x^3$.", steps: ["a", "b"], answer: "$3x^2$", video: null },
  ];

  it("names every example section differently, so axe landmark-unique passes", async () => {
    const { container } = render(<Blocks blocks={blocks} glossary={[]} lessonHref={lessonHref} />);
    const names = screen.getAllByRole("region").map((el) => el.getAttribute("aria-labelledby")!.split(" ").map((id) => document.getElementById(id)?.textContent).join(" "));
    expect(new Set(names).size).toBe(2);
    expect(names[0]).toContain("Worked example");
    expect(names[0]).toContain("Differentiate");
    expect(await violations(container, ["landmark-unique"])).toEqual([]);
  });

  it("stays unique even if two examples share one block id", async () => {
    const { container } = render(
      <>
        <ExampleSteps id="same" question={<span>First?</span>} steps={["s"]} answer="a" />
        <ExampleSteps id="same" question={<span>Second?</span>} steps={["s"]} answer="a" />
      </>,
    );
    const labels = screen.getAllByRole("region").map((el) => el.getAttribute("aria-labelledby"));
    expect(new Set(labels).size).toBe(2);
    expect(await violations(container, ["landmark-unique"])).toEqual([]);
  });
});

describe("cheat sheet headings", () => {
  const sections: Lesson["sections"] = [{ id: "s", heading: "S", blocks: [{ type: "formula", tex: "x=1", tag: "booklet", cheatSheet: true }] }];
  const course: Course = { ...base, lessons: [make("5.3", 5, "SL", "Powers", "powers", sections), make("2.5", 2, "SL", "Quadratics", "quadratics", sections)] };

  it("topic sheet: h1, h2 sheet title, then h3 block headings, no heading level skipped", async () => {
    const { container } = render(<CheatSheet course={course} topic={course.topics.find((t) => t.n === 5)!} />);
    expect(container.querySelectorAll("[data-block] > h3").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("h4").length).toBe(0);
    expect(await violations(container, ["heading-order"])).toEqual([]);
  });

  it("course sheet: h2 title, h3 per topic, h4 per block", async () => {
    const { container } = render(<CheatSheet course={course} />);
    expect(container.querySelectorAll("[data-topic] > h3").length).toBe(2);
    expect(container.querySelectorAll("[data-block] > h4").length).toBeGreaterThan(0);
    expect(await violations(container, ["heading-order"])).toEqual([]);
  });
});

describe("hint focus", () => {
  it("moves focus to the revealed hint instead of losing it", async () => {
    const user = userEvent.setup();
    render(<CheckQuestion id="c" prompt={<span>Q</span>} hint={<span>try u</span>} options={[{ content: "a", correct: true }]} explain={<span>e</span>} />);
    await user.click(screen.getByRole("button", { name: "Hint" }));
    expect(screen.queryByRole("button", { name: "Hint" })).toBeNull();
    const hint = screen.getByText("try u").closest("p") as HTMLElement;
    expect(document.activeElement).toBe(hint);
    expect(hint.textContent).toContain("Hint:");
  });
});

describe("status regions", () => {
  const current = make("2.5", 2, "SL", "Quadratics", "quadratics");
  const course: Course = { ...base, lessons: [current] };

  it("renders the Saved and Thanks regions empty first, then fills the same node", async () => {
    const user = userEvent.setup();
    render(<LessonPage course={course} lesson={current} />);
    const regions = screen.getAllByRole("status");
    const saved = regions.find((el) => el.className.includes("gotNote"))!;
    expect(saved.textContent).toBe("");
    await user.click(screen.getByText("I've got this ✓"));
    expect(screen.getAllByRole("status").find((el) => el.className.includes("gotNote"))).toBe(saved);
    expect(saved.textContent).toBe("Saved on this device");
    await user.click(screen.getByText("Understood ✓"));
    expect(saved.textContent).toBe("");

    const thanks = screen.getAllByRole("status").find((el) => el !== saved && !el.className.includes("srOnly") && el.textContent === "")!;
    expect(thanks).toBeTruthy();
    await user.click(screen.getByText("Report a problem"));
    await user.click(screen.getByText("A typo"));
    expect(thanks.isConnected).toBe(true);
    expect(thanks.textContent).toMatch(/Thanks/);
  });
});

describe("lesson search combobox", () => {
  const items: HomeItem[] = [
    { item: "5.15", topic: 5, level: "SL", name: "Integration by substitution", href: "/l/5-15" },
    { item: "5.16", topic: 5, level: "AHL", name: "Integration by parts", href: "/l/5-16" },
    { item: "5.17", topic: 5, level: "AHL", name: "Integration by tables", synonyms: ["parts table"] },
  ];
  const setup = () => {
    render(<LessonSearch items={items} />);
    const box = screen.getByRole("combobox", { name: "Search lessons" });
    fireEvent.change(box, { target: { value: "by" } });
    return box;
  };

  it("exposes a listbox of options and ties it to the input", () => {
    const box = setup();
    const list = screen.getByRole("listbox", { name: "Search results" });
    expect(box.getAttribute("aria-expanded")).toBe("true");
    expect(box.getAttribute("aria-controls")).toBe(list.id);
    expect(within(list).getAllByRole("option")).toHaveLength(3);
    expect(box.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("arrow keys move aria-activedescendant, skip unwritten rows and wrap", () => {
    const box = setup();
    const options = screen.getAllByRole("option");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box.getAttribute("aria-activedescendant")).toBe(options[0].id);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box.getAttribute("aria-activedescendant")).toBe(options[1].id);
    fireEvent.keyDown(box, { key: "ArrowDown" }); // 5.17 is not written: wraps to the first
    expect(box.getAttribute("aria-activedescendant")).toBe(options[0].id);
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(box.getAttribute("aria-activedescendant")).toBe(options[1].id);
    expect(options[2].getAttribute("aria-disabled")).toBe("true");
  });

  it("Enter opens the active option, or the first written one when none is active", () => {
    const box = setup();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(push).toHaveBeenLastCalledWith("/l/5-15");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(push).toHaveBeenLastCalledWith("/l/5-16");
  });

  it("clicking an option opens it", () => {
    setup();
    fireEvent.click(screen.getByRole("option", { name: /Integration by parts/ }));
    expect(push).toHaveBeenLastCalledWith("/l/5-16");
  });

  it("Escape closes the list and keeps the text, a second Escape clears it", () => {
    const box = setup() as HTMLInputElement;
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(box.getAttribute("aria-expanded")).toBe("false");
    expect(box.getAttribute("aria-activedescendant")).toBeNull();
    expect(box.value).toBe("by");
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box.value).toBe("");
    fireEvent.change(box, { target: { value: "by" } });
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("announces the result count in a live region that exists before it is filled, and a miss", () => {
    render(<LessonSearch items={items} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    const box = screen.getByRole("combobox");
    fireEvent.change(box, { target: { value: "by" } });
    expect(status.textContent).toBe("3 results");
    fireEvent.change(box, { target: { value: "zzz" } });
    expect(status.textContent).toBe("No lesson matches zzz");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("slider value text", () => {
  it("defaults aria-valuetext to the visible readout and accepts an override", () => {
    render(<Slider label="Angle" value={30} min={0} max={90} step={5} onChange={() => {}} format={(v) => `${v}°`} />);
    expect(screen.getByLabelText("Angle").getAttribute("aria-valuetext")).toBe("30°");
    cleanup();
    render(<Slider label="Angle" value={30} min={0} max={90} step={5} onChange={() => {}} format={(v) => `${v}°`} valueText={(v) => `${v} degrees`} />);
    expect(screen.getByLabelText("Angle").getAttribute("aria-valuetext")).toBe("30 degrees");
  });

  it("the Euler index slider reads as a step size, not a list position", () => {
    render(<EulerStep alt="alt" />);
    const slider = screen.getByLabelText(/^h /);
    expect(slider.getAttribute("aria-valuetext")).toBe("h = 0.25, 4 steps");
    fireEvent.change(slider, { target: { value: "0" } });
    expect(slider.getAttribute("aria-valuetext")).toBe("h = 0.05, 20 steps");
  });
});

describe("long pages", () => {
  const css = readFileSync(join(__dirname, "cheatsheet.module.css"), "utf8");
  const printBlock = css.slice(css.indexOf("@media print"), css.indexOf("/* Glossary and command terms */"));

  it("the cheat-sheet topics and glossary letters are skippable on screen and fully visible in print", () => {
    expect(css).toMatch(/\.topic \{[^}]*content-visibility: auto;[^}]*contain-intrinsic-block-size: auto/);
    expect(css).toMatch(/\.group \{[^}]*content-visibility: auto;[^}]*contain-intrinsic-block-size: auto/);
    expect(printBlock).toMatch(/\.topic, \.group \{[^}]*content-visibility: visible/);
  });

  it("glossary letter groups carry the entry count the size estimate uses and keep their labelled heading", () => {
    const course: Course = { ...base, lessons: [lessonFixture], glossary: [{ id: "a", term: "alpha", definition: "x", lesson: "5.5" }, { id: "b", term: "apple", definition: "y", lesson: "5.5" }] };
    render(<GlossaryIndex course={course} />);
    const group = screen.getByRole("region", { name: "A" });
    expect(group.style.getPropertyValue("--entries")).toBe("2");
  });
});
