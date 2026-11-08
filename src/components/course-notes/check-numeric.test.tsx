// Numeric checks: what a student can type, and that the feedback is right for physics-scale answers (PR #476 review).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { COURSES, getCourse } from "@/lib/course-notes/course";
import type { Block, CheckBlock } from "@/lib/course-notes/types";
import { CheckQuestion, parseNumeric, withinTolerance } from "./CheckQuestion";

afterEach(cleanup);

const numericChecks = (blocks: Block[]): CheckBlock[] =>
  blocks.flatMap((block) => (block.type === "check" && block.answer ? [block] : block.type === "example" && block.check?.answer ? [block.check] : []));

const allNumericChecks = () =>
  COURSES.flatMap((course) =>
    course.lessons.flatMap((lesson) =>
      [...(lesson.before ?? []), ...lesson.sections.flatMap((section) => section.blocks)].flatMap((block) =>
        numericChecks([block as Block]).map((check) => ({ where: `${course.slug} ${lesson.item} ${check.id}`, check })),
      ),
    ),
  );

describe("parseNumeric", () => {
  it.each([
    ["2.5", 2.5], ["−3", -3], ["1/2", 0.5], [" .5 ", 0.5],
    ["1.5e24", 1.5e24], ["6.6E-34", 6.6e-34], ["1.5×10^24", 1.5e24], ["1.5 x 10^-34", 1.5e-34],
    ["1.5*10^(−3)", 1.5e-3], ["3×10²⁴", 3e24], ["4.0 × 10⁻¹⁷", 4e-17], ["10^5", 1e5], ["2·10^{3}", 2000],
  ])("reads %s", (raw, want) => {
    expect(parseNumeric(raw)! / want).toBeCloseTo(1, 12);
  });
  it.each(["", "abc", "1e", "1/0", "10^", "1.5×10", "1e999", "2,5"])("refuses %s", (raw) => {
    expect(parseNumeric(raw)).toBeNull();
  });
});

describe("withinTolerance", () => {
  it("scales the floating-point allowance with the answer", () => {
    expect(withinTolerance(0, 6.6e-34, 0.05e-34)).toBe(false);
    expect(withinTolerance(6.63e-34, 6.6e-34, 0.05e-34)).toBe(true);
    expect(withinTolerance(0.1 + 0.2, 0.3, 0)).toBe(true);
    expect(withinTolerance(0, 0, 0)).toBe(true);
    expect(withinTolerance(1e-13, 0, 0)).toBe(true);
    expect(withinTolerance(1e-6, 0, 0)).toBe(false);
  });
});

describe("every numeric check in every course", () => {
  const checks = allNumericChecks();
  it("exists", () => expect(checks.length).toBeGreaterThan(100));
  it("does not accept 0 unless the answer is 0", () => {
    const bad = checks.filter(({ check }) => check.answer!.value !== 0 && withinTolerance(0, check.answer!.value, check.answer!.tolerance)).map(({ where }) => where);
    expect(bad).toEqual([]);
  });
  it("accepts its own answer typed in standard form", () => {
    const bad = checks.filter(({ check }) => {
      const { value, tolerance } = check.answer!;
      const typed = parseNumeric(value.toExponential());
      return typed === null || !withinTolerance(typed, value, tolerance);
    }).map(({ where }) => where);
    expect(bad).toEqual([]);
  });
});

describe("the reviewer's physics checks, mounted", () => {
  const block = (course: string, item: string, id: string) => {
    const lesson = getCourse(course)!.lessons.find((entry) => entry.item === item)!;
    const found = [...(lesson.before ?? []), ...lesson.sections.flatMap((section) => section.blocks)].flatMap((entry) => numericChecks([entry as Block])).find((check) => check.id === id);
    if (!found) throw new Error(`${course} ${item} ${id} not found`);
    return found;
  };
  const cases = [
    ["ib-physics", "5.4", "check-h-from-gradient"],
    ["ib-physics", "5.12", "check-mean-energy-at-core"],
    ["ib-physics", "2.12", "check-electron-energy"],
    ["ib-physics", "2.7", "check-molecules-from-n"],
  ] as const;
  it.each(cases)("%s %s %s: 0 is wrong, the answer in standard form is right", async (course, item, id) => {
    const check = block(course, item, id);
    const submit = async (text: string) => {
      cleanup();
      render(<CheckQuestion id={check.id} prompt="p" explain="e" answer={check.answer} />);
      await userEvent.type(screen.getByLabelText("Your answer"), text);
      await userEvent.click(screen.getByRole("button", { name: "Check" }));
      return screen.getByTestId("check-feedback").textContent ?? "";
    };
    expect(await submit("0")).toContain("Not quite");
    expect(await submit(check.answer!.value.toExponential(2))).toContain("Correct");
  });
});
