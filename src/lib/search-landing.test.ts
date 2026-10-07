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
import { CURATED_TOPIC_LANDINGS } from "@/lib/search-landing-topic-content";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  it("keeps the original top-two routes and adds only curated, live labels with meaningful inventory", () => {
    const datasets: Record<string, string> = {
      "igcse-biology-0610": "src/data/production/igcse-biology-0610.json",
      "igcse-economics-0455": "src/data/production/igcse-economics-0455.json",
      "igcse-chemistry-0620": "src/data/production/igcse-chemistry-0620.json",
      "igcse-physics-0625": "src/data/production/igcse-physics-0625.json",
      "igcse-coordinated-sciences-0654": "src/data/production/igcse-coordinated-sciences-0654.json",
      "ib-chemistry-hl": "src/data/raw/ib-chemistry-hl.json", "ib-chemistry-sl": "src/data/raw/ib-chemistry-sl.json",
      "ib-physics-hl": "src/data/raw/ib-physics-hl.json", "ib-physics-sl": "src/data/raw/ib-physics-sl.json",
      "ib-biology-hl": "src/data/raw/ib-biology-hl.json", "ib-biology-sl": "src/data/raw/ib-biology-sl.json",
      "ib-economics-hl": "src/data/local-preview/ib-economics-hl.json", "ib-economics-sl": "src/data/local-preview/ib-economics-sl.json",
    };
    for (const [slug, file] of Object.entries(datasets)) {
      const raw = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));
      const questions: UnifiedQuestion[] = raw.questions.map((q: Record<string, unknown>) => ({ ...question(q as Partial<UnifiedQuestion>), ...q, bankSlug: slug } as UnifiedQuestion));
      const manifest = buildLandingManifest(slug as Parameters<typeof buildLandingManifest>[0], questions);
      const labels = [...new Set(questions.flatMap(({ primaryTopic, secondaryTopics }) => [primaryTopic, ...secondaryTopics]))];
      const counts = new Map(labels.map((label) => [label, questions.filter((q) => q.primaryTopic === label || q.secondaryTopics.includes(label)).length]));
      const ranked = [...counts.entries()].filter(([, count]) => count >= 20).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      const oldLabels = slug === "igcse-biology-0610"
        ? ["Enzymes", "Biological molecules"]
        : ranked.slice(0, 2).map(([label]) => label);
      expect(manifest.topics.slice(0, oldLabels.length).map(({ label }) => label)).toEqual(oldLabels);
      expect(manifest.topics.length).toBe(oldLabels.length + (CURATED_TOPIC_LANDINGS[slug as keyof typeof CURATED_TOPIC_LANDINGS] ?? []).filter((label) => !oldLabels.includes(label)).length);
      expect(manifest.topics.every((topic) => topic.count >= 20)).toBe(true);
      expect(manifest.topics.every((topic) => topicPath(slug, topic).endsWith(`/${topic.slug}`))).toBe(true);
    }
    const old = buildLandingManifest("igcse", [
      ...Array.from({ length: 25 }, () => question({ primaryTopic: "Algebra and graphs" })),
      ...Array.from({ length: 21 }, () => question({ primaryTopic: "Number" })),
      ...Array.from({ length: 20 }, () => question({ primaryTopic: "Geometry" })),
    ]);
    expect(old.topics.map((topic) => topic.label)).toEqual(["Algebra and graphs", "Number"]);
  });
});
