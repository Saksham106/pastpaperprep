import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPersistedStoresForTests } from "./persisted-store";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getCourse, type Course } from "@/lib/course-notes/course";
import { lessonFixture } from "@/lib/course-notes/__fixtures__/lesson";
import type { Lesson } from "@/lib/course-notes/types";

const track = vi.hoisted(() => vi.fn());
const reviewed = vi.hoisted(() => ({ date: "2026-10-20" as string | undefined }));
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));
vi.mock("@/lib/updates", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/updates")>()), lastUpdated: () => reviewed.date }));

import { LessonPage, practiseItemsLabel } from "./LessonPage";

const base = getCourse("ib-math-aa") as Course;
const make = (item: string, topic: Lesson["topic"], level: Lesson["level"], title: string, slug: string, extra: Partial<Lesson> = {}): Lesson => ({ ...lessonFixture, item, topic, level, title, slug, ...extra });
const withFacts: Lesson["sections"] = [
  ...lessonFixture.sections,
  { id: "wrap", heading: "Wrap-up", blocks: [{ type: "fact", text: "Remember the $\\pm$.", tag: "learn", cheatSheet: true }, { type: "formula", tex: "x=1", tag: "booklet", cheatSheet: true }] },
];
const current = make("2.5", 2, "SL", "Quadratics", "quadratics", { prerequisites: ["2.1", "2.4"], sections: withFacts });
const course: Course = {
  ...base,
  lessons: [make("2.1", 2, "SL", "Linear functions", "linear"), make("2.4", 2, "SL", "Graphs", "graphs"), current, make("2.13", 2, "AHL", "Rational functions", "rational"), make("2.14", 2, "SL", "Modelling", "modelling")],
};

beforeEach(() => {
  window.localStorage.clear();
  resetPersistedStoresForTests();
  track.mockClear();
  reviewed.date = "2026-10-20";
});
afterEach(cleanup);

describe("LessonPage", () => {
  it("renders header badges, paper chips and Builds on links", () => {
    render(<LessonPage course={course} lesson={current} />);
    expect(screen.getByText("2.5 · SL")).toBeTruthy();
    expect(screen.getByText("Paper 1")).toBeTruthy();
    expect(screen.getByText("Paper 2")).toBeTruthy();
    const meta = screen.getByText(/Builds on/).parentElement as HTMLElement;
    expect(within(meta).getByRole("link", { name: "2.1 Linear functions" }).getAttribute("href")).toMatch(/2-1-linear$/);
    expect(within(meta).getByRole("link", { name: "2.4 Graphs" })).toBeTruthy();
    expect(screen.getByText("5 min read")).toBeTruthy();
  });

  it("shows the HL only badge for AHL lessons", () => {
    render(<LessonPage course={course} lesson={course.lessons[3]} />);
    expect(screen.getByText("2.13 · AHL · HL only")).toBeTruthy();
  });

  it("renders sections in order, then mistakes, tips, takeaways and Practise this", () => {
    render(<LessonPage course={course} lesson={current} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["In a minute", "You'll be able to", "Solving", "Common mistakes", "Exam tips", "Key takeaways", "Practise this"]);
    expect(document.querySelector("details summary")?.textContent).toMatch(/^Before you start/);
    const takeaways = (screen.getByRole("heading", { name: "Key takeaways" }).parentElement as HTMLElement);
    expect(within(takeaways).getByText("In booklet")).toBeTruthy();
    expect(within(takeaways).getByText("Learn this")).toBeTruthy();
  });

  it("hlNote blocks carry data-hl-note so the SL view can hide them", () => {
    const { container } = render(<LessonPage course={course} lesson={current} />);
    expect(container.querySelectorAll("[data-hl-note]").length).toBe(1);
    expect(container.querySelector("[data-view]")?.getAttribute("data-view")).toBe("HL");
  });

  it("I've got this adds the item to progress and clicking again removes it", async () => {
    const user = userEvent.setup();
    render(<LessonPage course={course} lesson={current} />);
    await user.click(screen.getByText("I've got this ✓"));
    expect(JSON.parse(window.localStorage.getItem("notes-progress:ib-math-aa") ?? "[]")).toEqual(["2.5"]);
    expect(screen.getByText("Understood ✓").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Saved on this device")).toBeTruthy();
    await user.click(screen.getByText("Understood ✓"));
    expect(JSON.parse(window.localStorage.getItem("notes-progress:ib-math-aa") ?? "[]")).toEqual([]);
  });

  it("Previous/Next skip AHL lessons in the SL view", async () => {
    render(<LessonPage course={course} lesson={current} />);
    const foot = () => within(document.querySelector("footer") as HTMLElement);
    expect(foot().getByRole("link", { name: /2\.13 Rational functions/ }).getAttribute("rel")).toBe("next");
    cleanup();
    window.localStorage.setItem("notes-level", "SL");
    resetPersistedStoresForTests(); // a fresh page load reads the stored level
    render(<LessonPage course={course} lesson={current} />);
    expect(foot().queryByRole("link", { name: /2\.13/ })).toBeNull();
    expect(foot().getByRole("link", { name: /2\.14 Modelling/ }).getAttribute("href")).toMatch(/2-14-modelling$/);
    expect(foot().getByRole("link", { name: /2\.4 Graphs/ }).getAttribute("rel")).toBe("prev");
  });

  it("Report a problem fires notes_report with a fixed issue and shows the email", async () => {
    const user = userEvent.setup();
    render(<LessonPage course={course} lesson={current} />);
    expect(screen.getByRole("link", { name: "hello@pastpaperprep.com" }).getAttribute("href")).toBe("mailto:hello@pastpaperprep.com");
    await user.click(screen.getByText("Report a problem"));
    expect(within(document.getElementById("report-menu") as HTMLElement).getAllByRole("button").length).toBe(5);
    await user.click(screen.getByText("A maths error"));
    expect(track).toHaveBeenCalledWith("notes_report", { lesson: "2.5", level: "HL", issue: "maths_error" });
    expect(screen.getByText(/Thanks/)).toBeTruthy();
  });

  it("Before you start is collapsed, and a wrong answer links the prerequisite lesson", async () => {
    const user = userEvent.setup();
    const { container } = render(<LessonPage course={course} lesson={current} />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(details).getByText(/Revise first:/)).toBeTruthy();
    const withLink: Lesson = { ...current, before: [{ ...current.before[0], explain: "Square both terms. Revise it in {{lesson:2.1}}." }] };
    cleanup();
    const second = render(<LessonPage course={course} lesson={withLink} />);
    const open = second.container.querySelector("details") as HTMLDetailsElement;
    open.open = true;
    await user.click(open.querySelectorAll("button")[0]);
    expect(within(open).getAllByRole("link", { name: /2\.1/ }).some((a) => /2-1-linear$/.test(a.getAttribute("href") ?? ""))).toBe(true);
  });

  it("lists an unwritten prerequisite by syllabus name, unlinked", () => {
    const lesson = { ...current, prerequisites: ["2.2"] };
    render(<LessonPage course={course} lesson={lesson} />);
    const meta = screen.getByText(/Builds on/).parentElement as HTMLElement;
    expect(within(meta).queryByRole("link")).toBeNull();
    expect(meta.textContent).toMatch(/Builds on 2\.2 \S/);
  });

  it("Last reviewed comes from the changelog, and is left out when there is none", () => {
    render(<LessonPage course={course} lesson={current} />);
    expect(screen.getByText("Last reviewed 20 Oct 2026")).toBeTruthy();
    cleanup();
    reviewed.date = undefined;
    render(<LessonPage course={course} lesson={current} />);
    expect(screen.queryByText(/Last reviewed/)).toBeNull();
  });

  it("Practise this names the group's items and counts at the current level", () => {
    const { container } = render(<LessonPage course={{ ...course, lessons: [...course.lessons] }} lesson={make("5.16", 5, "AHL", "By parts", "by-parts")} />);
    const band = container.querySelector("[data-practise]") as HTMLElement;
    expect(band.textContent).toMatch(/\d+ past-paper questions? on 5\.16 in the AA HL bank, each with a mark scheme and a worked explanation\./);
    expect(within(band).getByRole("link", { name: "Practise 5.16 →" }).getAttribute("href")).toContain("/banks/ib-hl?subtopic=Integration%20by%20substitution%20and%20parts");
  });

  it("labels item ranges", () => {
    expect(practiseItemsLabel(["3.14", "3.15", "3.16", "3.17", "3.18"])).toBe("3.14–3.18");
    expect(practiseItemsLabel(["2.13", "2.8"])).toBe("2.8 and 2.13");
    expect(practiseItemsLabel(["5.16"])).toBe("5.16");
    expect(practiseItemsLabel(["2.9", "3.1"])).toBe("2.9 and 3.1");
  });
});
