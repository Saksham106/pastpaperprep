import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getCourse, type Course } from "@/lib/course-notes/course";
import { lessonFixture } from "@/lib/course-notes/__fixtures__/lesson";
import type { Lesson } from "@/lib/course-notes/types";
import { CourseHome } from "./CourseHome";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const base = getCourse("ib-math-aa") as Course;
const make = (item: string, topic: Lesson["topic"], level: Lesson["level"], title: string, slug: string, synonyms: string[] = []): Lesson => ({
  ...lessonFixture,
  item,
  topic,
  level,
  title,
  slug,
  synonyms,
});
const course: Course = {
  ...base,
  lessons: [
    make("1.1", 1, "SL", "Standard form", "standard-form"),
    make("1.2", 1, "SL", "Sequences", "sequences"),
    make("2.5", 2, "SL", "Inverse functions", "inverse", ["inverse"]),
    make("5.16", 5, "AHL", "Integration by parts", "by-parts", ["integration by parts", "by parts"]),
  ],
};

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

const topicSection = (n: number) => screen.getByRole("region", { name: new RegExp(`^${course.topics[n - 1].name}`) });

describe("CourseHome", () => {
  it("SL view lists no AHL lessons and shows the +N line", async () => {
    window.localStorage.setItem("notes-level", "SL");
    render(<CourseHome course={course} />);
    const calculus = await vi.waitFor(() => {
      const section = topicSection(5);
      expect(within(section).getByText(/^\+8 HL-only lessons$/)).toBeTruthy();
      return section;
    });
    expect(within(calculus).queryByRole("link", { name: /5\.16/ })).toBeNull();
    expect(within(calculus).queryByRole("link", { name: /5\.12/ })).toBeNull();
    expect(within(topicSection(1)).queryByRole("listitem", { name: /1\.10/ })).toBeNull();
  });

  it('HL view shows "SL and HL" and "HL only" blocks per topic', () => {
    render(<CourseHome course={course} />);
    for (const topic of course.topics) {
      const section = topicSection(topic.n);
      expect(within(section).getByText(/SL and HL/i)).toBeTruthy();
      expect(within(section).getByText(/HL only/i)).toBeTruthy();
    }
    const link = within(topicSection(5)).getByRole("link", { name: /5\.16/ });
    expect(link.getAttribute("href")).toBe("/revision-notes/ib-math-aa/calculus/5-16-by-parts");
  });

  it("lists unwritten syllabus items as unlinked rows", () => {
    render(<CourseHome course={course} />);
    const section = topicSection(1);
    expect(within(section).getAllByText("Not written yet").length).toBeGreaterThan(0);
    expect(within(section).queryByRole("link", { name: /1\.3 / })).toBeNull();
  });

  it('search "by parts" finds 5.16; "2.5" finds 2.5', async () => {
    const user = userEvent.setup();
    render(<CourseHome course={course} />);
    const box = screen.getByRole("searchbox", { name: /search lessons/i });
    await user.type(box, "by parts");
    const results = screen.getByRole("list", { name: /search results/i });
    expect(within(results).getByText("5.16")).toBeTruthy();
    await user.clear(box);
    await user.type(box, "2.5");
    expect(within(screen.getByRole("list", { name: /search results/i })).getByText("2.5")).toBeTruthy();
  });

  it("Continue points at the first lesson in syllabus order that isn't understood at the current level", async () => {
    window.localStorage.setItem("notes-progress:ib-math-aa", JSON.stringify(["1.1"]));
    render(<CourseHome course={course} />);
    const continueLink = await vi.waitFor(() => {
      const link = screen.getByRole("link", { name: /^Continue/ });
      expect(link.textContent).toContain("1.2");
      return link;
    });
    expect(continueLink.getAttribute("href")).toBe("/revision-notes/ib-math-aa/number-and-algebra/1-2-sequences");
    cleanup();

    window.localStorage.setItem("notes-progress:ib-math-aa", JSON.stringify(["1.1", "1.2", "2.5"]));
    window.localStorage.setItem("notes-level", "SL");
    render(<CourseHome course={course} />);
    await vi.waitFor(() => expect(screen.queryByRole("link", { name: /^Continue/ })).toBeNull());
  });
});
