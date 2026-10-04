import { describe, expect, it } from "vitest";
import raw from "@/data/raw/igcse-additional.json";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { filterQuestions } from "@/lib/question-filter";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";
import { EARLIER_0606_SUBTOPICS, EARLIER_0606_TOPIC, OFFICIAL_0606_TOPICS, project0606Topics } from "@/lib/igcse-0606-official.mjs";

const source = raw.questions;
const normalized = loadBankQuestions("igcse-additional");
const current = new Set(OFFICIAL_0606_TOPICS);
const historical = new Set(EARLIER_0606_SUBTOPICS);

describe("0606 official topic projection", () => {
  it("preserves all source IDs, all 14 official headings, and the earlier-only group", () => {
    expect(normalized).toHaveLength(1633);
    expect(new Set(normalized.map((q) => q.id))).toEqual(new Set(source.map((q) => q.id)));
    expect(getTopicOptions(normalized)).toEqual([...OFFICIAL_0606_TOPICS, EARLIER_0606_TOPIC]);
    expect(source.every((q) => q.subtopics.length > 0 && q.subtopics.every((s) => current.has(s) || historical.has(s)))).toBe(true);
    for (const label of OFFICIAL_0606_TOPICS) {
      const reviewedEquationIds = new Set([
        "0606-2025-march-22-q3", "0606-2025-june-11-q4",
        "0606-2025-june-12-q2", "0606-2025-june-23-q13",
      ]);
      const expected = source.filter((q) => q.subtopics.includes(label)
        || (label === "Equations, inequalities and graphs" && reviewedEquationIds.has(q.id)))
        .map((q) => q.id).sort();
      expect(expected.length).toBeGreaterThan(0);
      expect(filterQuestions([...normalized], { topics: [label] }).map((q) => q.id).sort()).toEqual(expect.arrayContaining(expected));
    }
    const earlierIds = source.filter((q) => q.year < 2025 && q.subtopics.some((s) => historical.has(s))).map((q) => q.id).sort();
    expect(filterQuestions([...normalized], { topics: [EARLIER_0606_TOPIC] }).map((q) => q.id).sort()).toEqual(earlierIds);
  });

  it("uses the same projection for the SSR question and static public index, retaining original labels", () => {
    const byId = new Map(normalized.map((q) => [q.id, q]));
    for (const q of source) {
      const display = byId.get(q.id)!;
      const index = metadataFromRaw(q, { bank: "igcse-additional" });
      expect([display.primaryTopic, ...display.secondaryTopics]).toEqual([index.primaryTopic, ...index.secondaryTopics]);
      expect(index.subtopics).toEqual(expect.arrayContaining(q.subtopics));
      expect(display.subtopics).toEqual(index.subtopics);
      expect(display.searchText).toContain(q.primaryTopic.toLowerCase());
    }
  });

  it("keeps every original 0606 subtopic selectable under the projected topics", () => {
    const originalLabels = [...new Set(source.flatMap((q) => q.subtopics))].sort();
    const groups = getSubtopicGroups(normalized, [], []);
    expect(originalLabels).toHaveLength(17);
    expect(groups.all).toEqual(expect.arrayContaining(originalLabels));
    expect(getSubtopicGroups(normalized, ["Functions"], []).relevant).toContain("Functions");
    const earlier = getSubtopicGroups(normalized, [EARLIER_0606_TOPIC], []);
    expect(earlier.relevant).toEqual([...EARLIER_0606_SUBTOPICS]);
    expect(getSubtopicGroups(normalized, ["Functions"], ["Matrices"]).selectedOutsideContext).toContain("Matrices");
    for (const label of originalLabels) {
      const expected = source.filter((q) => q.subtopics.includes(label)).map((q) => q.id).sort();
      expect(filterQuestions([...normalized], { subtopics: [label] }).map((q) => q.id).sort()).toEqual(expected);
    }
  });

  it("keeps old topic/subtopic URLs and search while hiding skill codes from the student picker", () => {
    for (const old of ["Algebra", "Sets and functions", "Vectors and matrices"]) {
      const expected = source.filter((q) => q.primaryTopic === old || q.secondaryTopics?.includes(old)).map((q) => q.id).sort();
      expect(filterQuestions([...normalized], { topics: [old] }).map((q) => q.id).sort()).toEqual(expected);
    }
    for (const label of EARLIER_0606_SUBTOPICS) {
      expect(filterQuestions([...normalized], { subtopics: [label] }).length).toBeGreaterThan(0);
    }
    expect(getSubtopicGroups(normalized, [], []).all).toHaveLength(84);
    expect(getSubtopicGroups(normalized, [EARLIER_0606_TOPIC], []).relevant).toEqual(expect.arrayContaining([...EARLIER_0606_SUBTOPICS]));
    expect(getSubtopicGroups(normalized, [], ["Matrices"]).all).toHaveLength(84);
    expect(getSubtopicGroups(normalized, ["Functions"], []).relevant).toContain("Functions");
    expect(getSubtopicGroups([{ ...normalized[0], skills: ["__internal_code__"] }], [], []).all).not.toContain("__internal_code__");
    const searchable = normalized.find((q) => q.subtopics.includes("Indices and surds"))!;
    expect(filterQuestions([searchable], { search: "indices and surds" })).toHaveLength(1);
  });

  it("fails closed on an unmapped new source label", () => {
    expect(() => project0606Topics({ id: "new", subtopics: ["Unknown section"] })).toThrow(/new.*Unknown section/);
    expect(() => project0606Topics({ id: "new-2026", year: 2026, subtopics: ["Indices and surds"] })).toThrow(/needs source review/);
    const reviewed = source.find((q) => q.id === "0606-2025-march-22-q3")!;
    expect(() => project0606Topics({ ...reviewed, year: 2026 })).toThrow(/source identity changed/);
    expect(() => project0606Topics({ ...reviewed, subtopics: ["Matrices"] })).toThrow(/source identity changed/);
  });
});
