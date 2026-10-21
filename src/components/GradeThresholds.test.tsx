import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GradeThresholdsPage } from "@/components/GradeThresholds";
import { GRADE_THRESHOLDS, seriesYear } from "@/lib/grade-thresholds";

describe("grade threshold paper links", () => {
  const data = GRADE_THRESHOLDS[0];
  const years = [...new Set(data.tables.map((table) => seriesYear(table.series)).filter((year): year is number => year !== null))];

  it("links only years whose papers are in the library", () => {
    const [latest, ...older] = years;
    const markup = renderToStaticMarkup(<GradeThresholdsPage data={data} name="Test" papersHref="/past-papers/test" paperYears={older} />);
    expect(markup).not.toContain(`href="/past-papers/test/${latest}"`);
    for (const year of older) expect(markup).toContain(`href="/past-papers/test/${year}"`);
  });
});
