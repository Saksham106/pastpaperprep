import { describe, expect, it } from "vitest";
import { GRADE_THRESHOLDS, seriesYear } from "@/lib/grade-thresholds";
import { bankForSubjectSlug } from "@/lib/past-paper-catalog";

// Guards against transcription slips: shapes, monotonic grade columns and plausible marks.
describe("grade threshold data", () => {
  it("covers every IGCSE subject, newest series first, from Cambridge sources", () => {
    expect(GRADE_THRESHOLDS.map(({ subjectSlug }) => subjectSlug).sort()).toEqual([
      "igcse-additional-maths-0606", "igcse-biology-0610", "igcse-chemistry-0620", "igcse-coordinated-sciences-0654",
      "igcse-economics-0455", "igcse-maths-0580", "igcse-physics-0625",
    ]);
    for (const subject of GRADE_THRESHOLDS) {
      expect(bankForSubjectSlug(subject.subjectSlug), subject.subjectSlug).not.toBeNull();
      const order = subject.tables.map((table) => (seriesYear(table.series) ?? 0) * 12 + ["March", "June", "November"].indexOf(table.series.split(" ")[0]));
      expect(order, subject.subjectSlug).toEqual([...order].sort((a, b) => b - a));
      for (const table of subject.tables) expect(new URL(table.sourceUrl).hostname, `${subject.subjectSlug} ${table.series}`).toMatch(/(^|\.)cambridgeinternational\.org$/);
    }
  });

  it("keeps every row the right shape, within its maximum and non-increasing across grades", () => {
    for (const subject of GRADE_THRESHOLDS) for (const table of subject.tables) {
      for (const [kind, grid] of [["components", table.components], ["options", table.options]] as const) {
        expect(grid.rows.length, `${subject.subjectSlug} ${table.series} ${kind}`).toBeGreaterThan(0);
        for (const row of grid.rows) {
          const where = `${subject.subjectSlug} ${table.series} ${kind} ${JSON.stringify(row)}`;
          expect(row.values, where).toHaveLength(grid.headings.length);
          const marks = row.values.filter((value): value is number => value !== null);
          expect(marks.every((mark) => mark >= 0 && mark <= row.maxMark), where).toBe(true);
          expect(marks.every((mark, index) => index === 0 || mark <= marks[index - 1]), where).toBe(true);
        }
      }
    }
  });
});
