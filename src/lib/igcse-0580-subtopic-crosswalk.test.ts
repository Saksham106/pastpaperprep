import { describe, expect, it } from "vitest";
import { project0580Sections, MATH_0580_SECTIONS } from "./igcse-0580-official.mjs";
import { readFileSync } from "node:fs";

describe("0580 deterministic existing-label crosswalk", () => {
  it("does not collapse split legacy labels to one arbitrary official section", () => {
    for (const [primaryTopic, label] of [["Geometry", "Circle theorems"], ["Statistics", "Histograms and cumulative frequency"], ["Probability", "Combined and conditional probability"], ["Coordinate geometry", "Straight-line graphs"], ["Transformations and vectors", "Vectors"]]) {
      expect(project0580Sections({ id: "split-fixture", component: "22", primaryTopic, secondaryTopics: [], subtopics: [label], accessibleText: "Insufficient operation evidence" }).needsReview).toBe(true);
    }
  });
  it("uses explicit assessed requests to separate split sections", () => {
    const common = { id: "operation-fixture", component: "22", secondaryTopics: [] };
    expect(project0580Sections({ ...common, primaryTopic: "Statistics", subtopics: ["Histograms and cumulative frequency"], accessibleText: "Complete the histogram using frequency density." }).codeRefs).toContain("current_2025:E9.7");
    expect(project0580Sections({ ...common, primaryTopic: "Statistics", subtopics: ["Histograms and cumulative frequency"], accessibleText: "Use the cumulative frequency graph to estimate the median." }).codeRefs).toContain("current_2025:E9.6");
    expect(project0580Sections({ ...common, primaryTopic: "Coordinate geometry", subtopics: ["Straight-line graphs"], accessibleText: "Find the equation of the line through A and B." }).codeRefs).toContain("current_2025:E3.5");
    expect(project0580Sections({ ...common, primaryTopic: "Transformations and vectors", subtopics: ["Vectors"], accessibleText: "Calculate the magnitude of vector AB." }).codeRefs).toContain("current_2025:E7.3");
  });
  it("preserves source primary ownership while adding an explicit secondary owner", () => {
    const result = project0580Sections({ id: "symmetry-fixture", component: "22", primaryTopic: "Transformations and vectors", secondaryTopics: [], subtopics: ["Transformations"], accessibleText: "State the lines of symmetry and rotational symmetry of the parallelogram." });
    expect(result.primaryTopic).toBe("Transformations and vectors");
    expect(result.secondaryTopics).toContain("Geometry");
    expect(result.codeRefs).toContain("current_2025:E4.5");
    expect(result.codeRefs).not.toContain("current_2025:E7.1");
  });
  it("maps only explicit single-section label equivalents and preserves topic ownership", () => {
    const row = { id: "crosswalk-circle", year: 2026, component: "11", primaryTopic: "Geometry", secondaryTopics: [], subtopics: ["Circle theorems"] };
    const result = project0580Sections(row);
    expect(result.needsReview).toBe(false);
    expect(result.codeRefs).toContain("current_2025:C4.7");
    expect(result.primaryTopic).toBe(row.primaryTopic);
  });
  it("does not force merged or operation-ambiguous labels into a nearest section", () => {
    const ambiguous = ["Angles and polygons", "Coordinates and geometry", "Data charts and diagrams", "Pythagoras and right-angle trigonometry", "Indices and surds"];
    for (const label of ambiguous) {
      const row = { id: `ambiguous-${label}`, year: 2026, component: "22", primaryTopic: "Geometry", secondaryTopics: [], subtopics: [label] };
      expect(project0580Sections(row).needsReview).toBe(true);
    }
  });
  it("uses only registered section codes for mapped labels", () => {
    const raw = JSON.parse(readFileSync("src/data/raw/igcse.json", "utf8")).questions;
    const mapped = raw.map((row: any) => project0580Sections(row)).filter((p: any) => !p.needsReview);
    const codes = new Set(MATH_0580_SECTIONS.flatMap((s: any) => [s.coreCode, s.extendedCode].filter(Boolean).map((c: string) => `current_2025:${c}`)));
    expect(mapped.length).toBeGreaterThanOrEqual(25);
    for (const result of mapped) for (const ref of result.codeRefs.filter((value: string) => value.startsWith("current_2025:"))) expect(codes.has(ref)).toBe(true);
  });
});
