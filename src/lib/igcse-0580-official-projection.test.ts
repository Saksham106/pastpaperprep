import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { filterQuestions } from "@/lib/question-filter";
import { displayedQuestionSubtopics } from "@/lib/presentation";
import { project0580Sections, MATH_0580_SECTIONS } from "./igcse-0580-official.mjs";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";

const raw = (JSON.parse(readFileSync(join(process.cwd(), "src/data/raw/igcse.json"), "utf8")) as { questions: Array<Record<string, unknown> & { id: string; subtopics: string[] }> }).questions;
const releasedQuestions = normalizeBankQuestions("igcse", raw);
const releasedById = new Map(releasedQuestions.map(q => [q.id, q]));
// Experimental mapping remains testable offline, never through the student loader.
const questions = raw.map(source => { const p = project0580Sections(source); return { ...releasedById.get(source.id)!, ...p, officialCodeRefs: p.codeRefs }; });
const byId = new Map(questions.map((question) => [question.id, question]));
const REVIEW = "Section not yet verified";

describe("0580 official topic-first section projection", () => {
  it("keeps nine topics and all 51 legacy filters beside the accepted 72-section additive tree", () => {
    expect(raw).toHaveLength(3967);
    expect(new Set(questions.map((question) => question.id)).size).toBe(3967);
    const topics = getTopicOptions(questions);
    expect(topics.slice(0, 9)).toEqual(["Number", "Algebra and graphs", "Coordinate geometry", "Geometry", "Mensuration", "Trigonometry", "Transformations and vectors", "Probability", "Statistics"]);
    expect(topics).toHaveLength(9);
    const groups = getSubtopicGroups(releasedQuestions, [], []);
    expect(groups.all).toHaveLength(123);
    expect(groups.all).not.toContain(REVIEW);
    expect(MATH_0580_SECTIONS).toHaveLength(72);
    expect(new Set(MATH_0580_SECTIONS.map(s => s.displayTitle)).size).toBe(72);
    for (const s of MATH_0580_SECTIONS) expect(groups.all).toContain(s.displayTitle);
  });

  it("preserves the 25 reviewed overrides and adds mappings without erasing old filters", () => {
    const sectionIds = questions.filter((question) => (question.officialCodeRefs ?? []).some((ref) => ref.startsWith("current_2025:")));
    expect(sectionIds.length).toBeGreaterThan(25);
    expect(questions.filter(question => question.officialCodeRefs?.some(ref => ref.startsWith("review_verified_2025:")))).toHaveLength(25);
    const surds = byId.get("0580-2026-march-22-q15")!;
    expect(surds.officialCodeRefs).toContain("current_2025:E1.18");
    expect(displayedQuestionSubtopics(surds)).toContain("Surds");
    expect(surds.subtopics).toEqual(expect.arrayContaining(raw.find(row => row.id === surds.id)?.subtopics ?? []));
    expect(filterQuestions([...questions], { subtopics: ["1.18 Surds"] }).map((question) => question.id)).toContain(surds.id);
    expect(byId.get("0580-2025-june-23-q3")?.officialCodeRefs).toContain("current_2025:E4.5");
    const unreviewed = questions.find(question => question.subtopics.includes("Matrix operations and algebra"))!;
    expect(unreviewed.officialCodeRefs).toEqual(["review:section"]);
    expect(unreviewed.skills).not.toContain(REVIEW);
    expect(displayedQuestionSubtopics(unreviewed)).toEqual(expect.arrayContaining(["Matrix operations and algebra"]));
    expect(displayedQuestionSubtopics(releasedById.get(unreviewed.id)!)).not.toContain(REVIEW);
    const existingLabels = [...new Set(raw.flatMap((row) => row.subtopics))].sort();
    expect(existingLabels).toHaveLength(51);
    for (const label of existingLabels) {
      // The source-only original sets remain intact; the served descendant
      // additionally owns two printed geometric-surd operations.
      const expectedIds = [...raw.filter((row) => row.subtopics.includes(label)).map((row) => row.id),
        ...(label === "Indices and surds" ? ["0580-2025-march-22-q18", "0580-2025-november-22-q17"] : [])].sort();
      expect(filterQuestions([...questions], { subtopics: [label] }).map((question) => question.id).sort(), label).toEqual(expectedIds);
    }
    const legacy = raw.filter((row) => row.subtopics.includes("Bounds and estimation")).map((row) => row.id).sort();
    expect(filterQuestions([...questions], { subtopics: ["Bounds and estimation"] }).map((question) => question.id).sort()).toEqual(legacy);
  });

  it("routes a source-backed cross-topic Sets question to Number while keeping its old Probability link", () => {
    const core = byId.get("0580-2025-june-31-q26")!;
    const extended = byId.get("0580-2026-june-23-q25")!;
    expect(core.primaryTopic).toBe("Number");
    expect(core.secondaryTopics).toContain("Probability");
    expect(core.officialCodeRefs).toContain("current_2025:C1.2");
    expect(extended.officialCodeRefs).toContain("current_2025:E1.2");
    expect(displayedQuestionSubtopics(core)).toContain("Sets");
    expect(core.subtopics).toEqual(expect.arrayContaining(raw.find(row => row.id === core.id)?.subtopics ?? []));
    expect(filterQuestions([...questions], { topics: ["Probability"] }).map((question) => question.id)).toContain(core.id);
    expect(filterQuestions([...questions], { subtopics: ["1.2 Sets"] }).map((question) => question.id)).toEqual(expect.arrayContaining([core.id, extended.id]));
  });

  it("keeps runtime/public-index metadata identical for every served row", () => {
    for (const source of raw) {
      const runtime = releasedById.get(source.id)!;
      const index = metadataFromRaw(source, { bank: "igcse" });
      expect(index.primaryTopic).toBe(runtime.primaryTopic);
      expect(index.secondaryTopics).toEqual(runtime.secondaryTopics);
      expect(index.subtopics).toEqual(runtime.subtopics);
      expect(index.skills).toEqual(runtime.skills);
      expect(index.officialCodeRefs ?? []).toEqual(runtime.officialCodeRefs ?? []);
      expect(displayedQuestionSubtopics(runtime)).toEqual(displayedQuestionSubtopics({ ...runtime, subtopics: index.subtopics }));
      expect(displayedQuestionSubtopics(runtime).some(label => /^\d+\.\d+ /.test(label))).toBe(false);
    }
  }, 60_000);
});
