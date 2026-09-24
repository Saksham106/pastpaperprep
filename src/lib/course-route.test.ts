import { describe, expect, it } from "vitest";
import { deriveCourseRoute, matchesCourseRoute, supportsCourseRoute } from "@/lib/course-route";

describe("course routes", () => {
  it("derives Core, Extended, and shared practical routes", () => {
    expect(deriveCourseRoute("igcse", 1)).toBe("core");
    expect(deriveCourseRoute("igcse", 3)).toBe("core");
    expect(deriveCourseRoute("igcse", 2)).toBe("extended");
    expect(deriveCourseRoute("igcse", 4)).toBe("extended");
    expect(deriveCourseRoute("igcse-chemistry-0620", 5)).toBe("both");
    expect(deriveCourseRoute("igcse-chemistry-0620", 6)).toBe("both");
  });

  it("shows shared practical papers in either selected route", () => {
    expect(matchesCourseRoute("both", "core")).toBe(true);
    expect(matchesCourseRoute("both", "extended")).toBe(true);
    expect(matchesCourseRoute("extended", "core")).toBe(false);
  });

  it("supports exactly the five Core/Extended Cambridge banks", () => {
    expect([
      "igcse",
      "igcse-biology-0610",
      "igcse-chemistry-0620",
      "igcse-physics-0625",
      "igcse-coordinated-sciences-0654",
    ].every((bank) => supportsCourseRoute(bank as Parameters<typeof supportsCourseRoute>[0]))).toBe(true);
    expect(supportsCourseRoute("igcse-additional")).toBe(false);
    expect(supportsCourseRoute("ib-hl")).toBe(false);
    expect(deriveCourseRoute("ib-hl", 1)).toBe("");
  });
});
