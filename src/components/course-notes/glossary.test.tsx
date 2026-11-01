import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { getCourse, type Course } from "@/lib/course-notes/course";
import { lessonFixture } from "@/lib/course-notes/__fixtures__/lesson";
import { CommandTerms } from "./CommandTerms";
import { GlossaryIndex } from "./GlossaryIndex";

const base = getCourse("ib-math-aa") as Course;
const course: Course = {
  ...base,
  lessons: [lessonFixture],
  glossary: [
    { id: "vertex", term: "vertex", definition: "Turning point of a parabola.", lesson: "2.9" },
    { id: "axis", term: "Axis of symmetry", definition: "The line $x=-\\frac{b}{2a}$.", lesson: "2.5" },
    { id: "discriminant", term: "discriminant", definition: "$b^2-4ac$", lesson: "2.5" },
  ],
  commandTerms: [
    { id: "write-down", term: "Write down", definition: "Give the answer, little working." },
    { id: "calculate", term: "Calculate", definition: "Find a numerical answer, with $\\pi$ if needed." },
  ],
};
afterEach(cleanup);

describe("GlossaryIndex", () => {
  it("lists terms A to Z with rendered maths and a lesson link, plain text when unwritten", () => {
    render(<GlossaryIndex course={course} />);
    expect([...document.querySelectorAll("dt")].map((el) => el.textContent)).toEqual(["Axis of symmetry", "discriminant", "vertex"]);
    const axis = document.querySelector('[data-term="axis"]') as HTMLElement;
    expect(axis.querySelector(".katex")).toBeTruthy();
    expect(within(axis).getByRole("link", { name: "2.5 Quadratics" }).getAttribute("href")).toMatch(/2-5-quadratics$/);
    const vertex = document.querySelector('[data-term="vertex"]') as HTMLElement;
    expect(vertex.querySelector("a")).toBeNull();
    expect(vertex.textContent).toContain("Taught in 2.9");
    expect(screen.getByRole("link", { name: "V" })).toBeTruthy();
  });
});

describe("CommandTerms", () => {
  it("lists terms A to Z", () => {
    render(<CommandTerms course={course} />);
    expect([...document.querySelectorAll("dt")].map((el) => el.textContent)).toEqual(["Calculate", "Write down"]);
    expect(document.querySelector('[data-term="calculate"] .katex')).toBeTruthy();
  });

  it("shows an empty state when there are none", () => {
    render(<CommandTerms course={{ ...course, commandTerms: [] }} />);
    expect(document.querySelector("[data-empty]")).toBeTruthy();
    expect(document.querySelector("dt")).toBeNull();
  });
});
