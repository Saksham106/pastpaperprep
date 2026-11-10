import { describe, expect, it } from "vitest";
import { COURSES } from "./course";
import { footerLessons, prevNext } from "./neighbours";

describe("lesson footer neighbours", () => {
  it("picks the same previous/next lessons from the trimmed list as from the whole course, in both views", () => {
    let checked = 0;
    for (const course of COURSES) {
      for (const lesson of course.lessons) {
        const trimmed = footerLessons(course.lessons, lesson.item, course.levels.base);
        expect(trimmed.length).toBeLessThanOrEqual(5);
        for (const extensionView of [false, true]) {
          expect(prevNext(trimmed, lesson.item, course.levels.base, extensionView), `${course.slug} ${lesson.item}`).toEqual(prevNext(course.lessons, lesson.item, course.levels.base, extensionView));
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(600);
  });
});
