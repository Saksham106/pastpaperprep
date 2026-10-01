import { describe, expect, it } from "vitest";
import { project0580Sections, MATH_0580_SECTIONS } from "./igcse-0580-official.mjs";
import { readFileSync } from "node:fs";

describe("0580 deterministic existing-label crosswalk", () => {
  it("maps only explicit single-section label equivalents and preserves topic ownership", () => {
    const row = { id: "crosswalk-circle", year: 2026, component: "22", primaryTopic: "Geometry", secondaryTopics: [], subtopics: ["Circle theorems"] };
    const result = project0580Sections(row);
    expect(result.needsReview).toBe(false);
    expect(result.codeRefs).toContain("current_2025:E4.7");
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
