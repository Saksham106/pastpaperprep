import { describe, expect, it } from "vitest";
import { assessmentGuideFor } from "@/lib/assessment-guides";
import { getCatalogBank } from "@/lib/catalog";

describe("source-verified Co-ordinated Sciences assessment", () => {
  it("uses the 2025–2027 0654 timings, not single-science timings", () => {
    const bank = getCatalogBank("igcse-coordinated-sciences-0654")!;
    const guide = assessmentGuideFor(bank);
    expect(guide.version).toBe("2025–2027 syllabus");
    expect(guide.papers.map(({ name, duration, marks }) => [name, duration, marks])).toEqual([
      ["Paper 1", "45 min", "40"], ["Paper 2", "45 min", "40"],
      ["Paper 3", "2 hr", "120"], ["Paper 4", "2 hr", "120"],
      ["Paper 5", "2 hr", "60"], ["Paper 6", "1 hr 30 min", "60"],
    ]);
    expect(assessmentGuideFor(getCatalogBank("igcse-biology-0610")!).papers.find(p => p.name === "Paper 6")?.duration).toBe("1 hr");
  });
});
