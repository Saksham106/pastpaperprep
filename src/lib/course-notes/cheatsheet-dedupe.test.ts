import { describe, expect, it } from "vitest";
import { lessonFixture } from "./__fixtures__/lesson";
import { getCourse, type Course } from "./course";
import { topicBlocks } from "./cheatsheet";
import type { Lesson } from "./types";

const base = getCourse("ib-math-aa") as Course;

describe("cheat-sheet rows", () => {
  it("shows a formula or fact flagged in the body and again in the takeaways once", () => {
    const lesson: Lesson = {
      ...lessonFixture,
      item: "5.3",
      topic: 5,
      level: "SL",
      sections: [
        { id: "body", heading: "Body", blocks: [{ type: "formula", tex: "f'(x)=nx^{n-1}", tag: "booklet", cheatSheet: true }, { type: "fact", text: "Gradient is $f'(a)$.", tag: "learn", cheatSheet: true }] },
        { id: "takeaways", heading: "Key takeaways", blocks: [{ type: "formula", tex: "f'(x) = n x^{n-1}", tag: "booklet", cheatSheet: true }, { type: "fact", text: "Gradient is $f'(a)$.", tag: "learn", cheatSheet: true }, { type: "formula", tex: "y-y_1=m(x-x_1)", tag: "learn", cheatSheet: true }] },
      ],
    };
    const course: Course = { ...base, lessons: [lesson], cheatSheets: {} };
    const calculus = course.topics.find((topic) => topic.n === 5)!;
    const [block] = topicBlocks(course, calculus);
    expect(block.rows.map((row) => row.value)).toEqual(["f'(x)=nx^{n-1}", "Gradient is $f'(a)$.", "y-y_1=m(x-x_1)"]);
  });

  it("the real course has no duplicate rows inside any lesson block", () => {
    for (const topic of base.topics)
      for (const block of topicBlocks(base, topic)) {
        const keys = block.rows.map((row) => `${row.kind}:${row.value.replace(/\s+/g, "")}`);
        expect(new Set(keys).size, block.key).toBe(keys.length);
      }
  });
});
