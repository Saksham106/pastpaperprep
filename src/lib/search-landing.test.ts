import { describe, expect, it } from "vitest";
import type { UnifiedQuestion } from "@/lib/questions";
import {
  buildLandingManifest,
  officialQualificationSource,
  paperFilterHref,
  paperPath,
  topicFilterHref,
  topicPath,
} from "@/lib/search-landing";
import { getCatalogBank } from "@/lib/catalog";

function question(overrides: Partial<UnifiedQuestion>): UnifiedQuestion {
  return {
    primaryTopic: "Algebra and graphs",
    secondaryTopics: [],
    paper: 2,
    year: 2025,
    session: "May/June",
    component: "22",
    ...overrides,
  } as UnifiedQuestion;
}

describe("search landing manifests", () => {
  it("preserves exact filter values while using stable path slugs", () => {
    const questions = [
      ...Array.from({ length: 25 }, () => question({ primaryTopic: "Algebra and graphs" })),
      ...Array.from({ length: 21 }, () => question({ primaryTopic: "Number", paper: 4, component: "42" })),
      question({ primaryTopic: "Other" }),
    ];
    const manifest = buildLandingManifest("igcse", questions);

    expect(manifest.topics.map(({ label }) => label)).toEqual(["Algebra and graphs", "Number"]);
    expect(manifest.topics.map(({ slug }) => slug)).toEqual(["algebra-and-graphs", "number"]);
    expect(manifest.syllabusTopics.some(({ label }) => label === "Other")).toBe(false);
    expect(manifest.papers.map(({ slug }) => slug)).toEqual(["paper-2", "paper-4"]);
    expect(topicPath("igcse", manifest.topics[0])).toBe("/banks/igcse/topics/algebra-and-graphs");
    expect(paperPath("igcse", manifest.papers[0])).toBe("/banks/igcse/papers/paper-2");
    expect(topicFilterHref("igcse", "Algebra and graphs")).toBe("/banks/igcse?topic=Algebra%20and%20graphs");
    expect(paperFilterHref("igcse", 2)).toBe("/banks/igcse?paper=2");
  });

  it("uses current 0610 syllabus headings and totals equivalent historical papers together", () => {
    const questions = [
      ...Array.from({ length: 24 }, (_, i) => question({ id: `old-${i}`, primaryTopic: "Movement in and out of cells", bankSlug: "igcse-biology-0610", year: 2020 })),
      ...Array.from({ length: 5 }, (_, i) => question({ id: `new-${i}`, primaryTopic: "Movement into and out of cells", bankSlug: "igcse-biology-0610", year: 2025 })),
      question({ id: "both", primaryTopic: "Movement in and out of cells", secondaryTopics: ["Movement into and out of cells"], bankSlug: "igcse-biology-0610" }),
    ];
    const manifest = buildLandingManifest("igcse-biology-0610", questions);
    expect(manifest.syllabusTopics).toEqual([{ label: "Movement into and out of cells", count: 30, slug: "movement-into-and-out-of-cells" }]);
    expect(manifest.topics).toEqual(manifest.syllabusTopics);
    expect(topicFilterHref("igcse-biology-0610", manifest.topics[0].label))
      .toBe("/banks/igcse-biology-0610?topic=Movement%20into%20and%20out%20of%20cells");
  });

  it("keeps Cambridge source links explicit and official", () => {
    const physics = getCatalogBank("igcse-physics-0625");
    expect(physics).toBeDefined();
    expect(officialQualificationSource(physics!)).toBe(
      "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-physics-0625/",
    );
  });

  it("contains metadata only, never protected question payloads", () => {
    const manifest = buildLandingManifest(
      "igcse",
      Array.from({ length: 20 }, () => question({ primaryTopic: "Number" })),
    );
    const serialized = JSON.stringify(manifest);

    for (const forbidden of ["questionText", "answer", "solution", "asset", "storagePath", "signedUrl"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
