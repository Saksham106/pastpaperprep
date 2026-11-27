import { describe, expect, it } from "vitest";
import { notesTitle } from "./seo";

describe("notesTitle", () => {
  it("keeps the course name when the lesson title is long, so AA and AI lessons stay distinct", () => {
    const lesson = "Antidifferentiation, definite integrals and area";
    const aa = notesTitle(lesson, "IB Maths AA");
    const ai = notesTitle(lesson, "IB Maths AI");
    expect(aa).not.toBe(ai);
    expect(aa.endsWith(" | IB Maths AA")).toBe(true);
    expect(aa.length).toBeLessThanOrEqual(60);
  });

  it("uses the full form when it fits", () => {
    expect(notesTitle("Functions", "IB Maths AA")).toBe("Functions | IB Maths AA Notes");
  });
});
