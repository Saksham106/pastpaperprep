import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_BANK_INDEX_FILES } from "../src/lib/bank-index-manifest.ts";
import { metadataFromRaw } from "./generate-bank-index.mjs";

describe("public bank index generator", () => {
  it("does not copy courseEra or private fields from raw questions", () => {
    const metadata = metadataFromRaw({
      id: "q1",
      courseEra: "aa-hl",
      summary: "private summary",
      accessibleText: "private text",
      solution: "private solution",
      questionImages: ["questions/q1.webp"],
      markschemeImages: ["markschemes/q1.webp"],
      officialMarkscheme: { images: ["markschemes/q1.webp"] },
    });

    expect(metadata).not.toHaveProperty("courseEra");
    for (const key of ["summary", "accessibleText", "solution", "questionImages", "markschemeImages"]) {
      expect(metadata).not.toHaveProperty(key);
    }
  });

  it("projects 0610 numeric section codes to the year-era official name and preserves code provenance", () => {
    const metadata = metadataFromRaw({
      id: "0610-2026-m-12-q1", year: 2026, courseEra: "2026_2028", primaryTopic: "Characteristics and classification of living organisms",
      subtopics: ["1.1"], detailedSubtopics: ["1.1"],
    }, { bank: "igcse-biology-0610", normalizedProduction: true });

    expect(metadata.subtopics).toEqual(["Characteristics of living organisms", "1.1"]);
    expect(metadata.officialCodeRefs).toEqual(["2026_2028:1.1"]);

    const currentEdition = metadataFromRaw({
      id: "0610-2026-m-12-q16", year: 2026, courseEra: "2026_2028", primaryTopic: "Reproduction",
      subtopics: ["16.5"],
    }, { bank: "igcse-biology-0610", normalizedProduction: true });
    expect(currentEdition.subtopics).toEqual(["Sex hormones in humans", "Sexual hormones in humans", "16.5"]);
  });

  it("matches the 0610 public index exactly to the source runtime through the official-era projector", () => {
    const slug = "igcse-biology-0610";
    const source = JSON.parse(readFileSync(join(process.cwd(), "src/data/production", `${slug}.json`), "utf8"));
    const published = JSON.parse(readFileSync(join(process.cwd(), "public/bank-index", PUBLIC_BANK_INDEX_FILES[slug]), "utf8"));
    const expected = new Map(source.questions.map((raw) => [raw.id, metadataFromRaw(raw, { bank: slug, normalizedProduction: true })]));
    expect(published.questions).toHaveLength(source.questions.length);
    expect(expected.size).toBe(source.questions.length);
    const namedYears = source.questions.filter((row) => row.year >= 2021 && row.year <= 2025);
    expect(namedYears).toHaveLength(3441);
    expect(namedYears.every((row) => !row.subtopics.some((label) => /^\d+\.\d+$/.test(label)))).toBe(true);
    expect(published.questions.filter((row) => row.officialCodeRefs?.some((code) => /^(2020_2021|2022|2023_2025|2026_2028):\d+\.\d+$/.test(code)))).toHaveLength(4910);
    for (const row of published.questions) expect(row).toEqual(expected.get(row.id));
  });

  it("maps production AA slugs to the canonical overlay bank IDs", () => {
    const metadata = metadataFromRaw(
      { id: "2017-may-p2-tz1-q1" },
      { bank: "ib-sl" },
    );

    expect(metadata.granularLabels).toContain("math.aa.statistics-probability.expected-value-variance");
  });

  it("omits empty retrieval metadata while preserving populated Economics fields", () => {
    expect(metadataFromRaw({ id: "empty", officialCodeRefs: [], retrievalFacets: [] })).not.toEqual(expect.objectContaining({
      officialCodeRefs: expect.anything(),
      retrievalFacets: expect.anything(),
    }));
    expect(metadataFromRaw({
      id: "economics",
      officialCodeRefs: ["new_first_assessment_2022/2.1"],
      retrievalFacets: ["facet.trade-and-advantage"],
    })).toMatchObject({
      officialCodeRefs: ["new_first_assessment_2022/2.1"],
      retrievalFacets: ["facet.trade-and-advantage"],
    });
  });
});
