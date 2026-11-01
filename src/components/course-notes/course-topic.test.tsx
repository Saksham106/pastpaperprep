import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import taxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import items from "@/data/aa-official-subtopics/items.json";
import { getCourse, type Course } from "@/lib/course-notes/course";
import { lessonFixture } from "@/lib/course-notes/__fixtures__/lesson";
import { groupQuestionCounts } from "@/lib/course-notes/practice";
import type { Lesson } from "@/lib/course-notes/types";
import { CourseTopic } from "./CourseTopic";

const base = getCourse("ib-math-aa") as Course;
const make = (item: string, topic: Lesson["topic"], level: Lesson["level"], title: string, slug: string): Lesson => ({ ...lessonFixture, item, topic, level, title, slug, summary: `Summary of ${item}` });
const course: Course = {
  ...base,
  lessons: [make("5.1", 5, "SL", "Limits", "limits"), make("5.2", 5, "SL", "Increasing and decreasing", "inc-dec"), make("5.16", 5, "AHL", "By parts", "by-parts")],
};
const calculus = course.topics.find((topic) => topic.n === 5)!;
const groups = (taxonomy.groups as { id: string; studentFacingName: string; parentTopic: string; teachingOrder: number; applicability: string[]; memberOfficialItems: string[] }[])
  .filter((group) => group.parentTopic === "Calculus")
  .sort((a, b) => a.teachingOrder - b.teachingOrder);

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("CourseTopic", () => {
  it("renders stages in taxonomy teaching order", () => {
    render(<CourseTopic course={course} topic={calculus} />);
    const ids = [...document.querySelectorAll("[data-stage]")].map((el) => el.getAttribute("data-stage"));
    expect(ids).toEqual(groups.map((group) => group.id));
  });

  it("shows every syllabus item of the topic, unwritten ones unlinked", () => {
    render(<CourseTopic course={course} topic={calculus} />);
    const expected = items.items.filter((entry) => entry.topic === 5);
    expect(document.querySelectorAll("[data-lesson]").length).toBe(expected.length);
    expect(screen.getByRole("link", { name: /5\.1 Limits/ }).getAttribute("href")).toMatch(/\/calculus\/5-1-limits$/);
    expect(screen.queryByRole("link", { name: /5\.3 / })).toBeNull();
    expect(screen.getAllByText("Not written yet").length).toBe(expected.length - 3);
  });

  it("hides the group name for single-lesson groups only", () => {
    render(<CourseTopic course={course} topic={calculus} />);
    for (const group of groups) {
      const stage = document.querySelector(`[data-stage="${group.id}"]`) as HTMLElement;
      const name = stage.querySelector("[data-group-name]");
      if (group.memberOfficialItems.length > 1) expect(name?.textContent).toBe(group.studentFacingName);
      else expect(name?.textContent ?? "").toBe("");
    }
  });

  it("counts questions from the overlay per level, and links to the bank", () => {
    render(<CourseTopic course={course} topic={calculus} />);
    const first = groups[0];
    const counts = groupQuestionCounts(first.id);
    const link = within(document.querySelector(`[data-stage="${first.id}"]`) as HTMLElement).getByRole("link", { name: `${counts.SL} SL · ${counts.HL} HL questions` });
    expect(link.getAttribute("href")).toContain("/banks/ib-hl?topic=Calculus&subtopic=Limits%20and%20derivative%20foundations");
    const hlOnly = groups.find((group) => !group.applicability.includes("SL"))!;
    const hlCounts = groupQuestionCounts(hlOnly.id);
    expect(within(document.querySelector(`[data-stage="${hlOnly.id}"]`) as HTMLElement).getByRole("link", { name: `${hlCounts.HL} HL questions` })).toBeTruthy();
  });

  it("puts HL-only groups in the HL band and dims it in the SL view", async () => {
    window.localStorage.setItem("notes-level", "SL");
    render(<CourseTopic course={course} topic={calculus} />);
    const hlBand = document.querySelector("[data-band='hl']") as HTMLElement;
    await within(hlBand).findByText(/switch to HL to study these/);
    expect(hlBand.getAttribute("data-dimmed")).toBe("true");
    expect(document.querySelector("[data-band='sl']")?.getAttribute("data-dimmed")).toBe("false");
    expect(hlBand.querySelectorAll("[data-stage]").length).toBe(groups.filter((group) => !group.applicability.includes("SL")).length);
  });

  it("keeps HL-band links present and clickable in the SL view", async () => {
    window.localStorage.setItem("notes-level", "SL");
    render(<CourseTopic course={course} topic={calculus} />);
    const hlBand = document.querySelector("[data-band='hl']") as HTMLElement;
    await within(hlBand).findByText(/switch to HL to study these/);
    expect(within(hlBand).getByRole("link", { name: /5\.16 By parts/ }).getAttribute("href")).toMatch(/5-16-by-parts$/);
    expect(within(hlBand).getAllByRole("link").length).toBeGreaterThan(1);
    expect(hlBand.hasAttribute("inert")).toBe(false);
  });

  it("tags every AHL card with a text marker, in both bands", () => {
    render(<CourseTopic course={course} topic={calculus} />);
    const ahl = items.items.filter((entry) => entry.topic === 5 && entry.level === "AHL").map((entry) => entry.item);
    const tagged = [...document.querySelectorAll("[data-lesson]")].filter((card) => card.querySelector("[data-ahl-tag]")).map((card) => card.getAttribute("data-lesson"));
    expect(tagged.sort()).toEqual([...ahl].sort());
    expect(screen.getAllByText("◆ HL").length).toBe(ahl.length);
  });

  it("includes the lesson summary in the card for keyboard focus", () => {
    render(<CourseTopic course={course} topic={calculus} />);
    expect(within(screen.getByRole("link", { name: /5\.1 Limits/ })).getByText("Summary of 5.1")).toBeTruthy();
  });

  it("does not dim the HL band in the HL view", () => {
    render(<CourseTopic course={course} topic={calculus} />);
    expect(document.querySelector("[data-band='hl']")?.getAttribute("data-dimmed")).toBe("false");
    expect(screen.queryByText(/switch to HL to study these/)).toBeNull();
  });

  it("marks understood lessons, fills the stage, and points Continue at the next written lesson", async () => {
    window.localStorage.setItem("notes-progress:ib-math-aa", JSON.stringify(["5.1"]));
    render(<CourseTopic course={course} topic={calculus} />);
    const stage = document.querySelector(`[data-stage="${groups[0].id}"]`) as HTMLElement;
    await vi.waitFor(() => expect(stage.getAttribute("data-progress")).toBe("part"));
    expect(within(stage).getByText("Next up")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Continue.*5\.2/ }).getAttribute("href")).toMatch(/5-2-inc-dec$/);
  });

  it("shows the real meta line and the cheat sheet link", () => {
    render(<CourseTopic course={course} topic={calculus} />);
    expect(screen.getByText(/^19 lessons · 8 HL only · 147 past-paper questions in the HL bank$/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Calculus cheat sheet" }).getAttribute("href")).toMatch(/\/calculus\/cheat-sheet$/);
  });
});
