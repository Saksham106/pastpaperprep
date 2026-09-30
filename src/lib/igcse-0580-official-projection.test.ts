import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { filterQuestions } from "@/lib/question-filter";
import { displayedQuestionSubtopics } from "@/lib/presentation";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";

const raw = (JSON.parse(readFileSync(join(process.cwd(), "src/data/raw/igcse.json"), "utf8")) as { questions: Array<Record<string, unknown> & { id: string; subtopics: string[] }> }).questions;
const questions = normalizeBankQuestions("igcse", raw);
const byId = new Map(questions.map((question) => [question.id, question]));
const REVIEW = "Section not yet verified";

describe("0580 official topic-first section projection", () => {
  it("shows the full nine-topic/72-section tree plus an explicit countable review choice", () => {
    expect(raw).toHaveLength(3967);
    expect(new Set(questions.map((question) => question.id)).size).toBe(3967);
    const topics = getTopicOptions(questions);
    expect(topics.slice(0, 9)).toEqual(["Number", "Algebra and graphs", "Coordinate geometry", "Geometry", "Mensuration", "Trigonometry", "Transformations and vectors", "Probability", "Statistics"]);
    expect(topics).toContain("Questions needing section review");
    const groups = getSubtopicGroups(questions, [], []);
    expect(groups.all).toHaveLength(73);
    expect(groups.all.at(-1)).toBe(REVIEW);
    expect(groups.all.slice(0, -1)).toEqual([...new Set(groups.all.slice(0, -1))]);
    expect(filterQuestions([...questions], { subtopics: [REVIEW] })).toHaveLength(3942);
  });

  it("assigns only 25 exact source-reviewed IDs to numbered sections, with original labels still searchable", () => {
    const sectionIds = questions.filter((question) => (question.officialCodeRefs ?? []).some((ref) => ref.startsWith("current_2025:")));
    expect(sectionIds).toHaveLength(25);
    const surds = byId.get("0580-2026-march-22-q15")!;
    expect(surds.officialCodeRefs).toContain("current_2025:E1.18");
    expect(displayedQuestionSubtopics(surds)).toEqual(["1.18 Surds"]);
    expect(filterQuestions([...questions], { subtopics: ["1.18 Surds"] }).map((question) => question.id)).toContain(surds.id);
    const unreviewed = byId.get("0580-2025-june-23-q3")!;
    expect(unreviewed.officialCodeRefs).toEqual(["review:section"]);
    expect(unreviewed.skills).not.toContain(REVIEW);
    expect(displayedQuestionSubtopics(unreviewed)).toEqual([REVIEW]);
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
    expect(displayedQuestionSubtopics(core)).toEqual(["1.2 Sets"]);
    expect(filterQuestions([...questions], { topics: ["Probability"] }).map((question) => question.id)).toContain(core.id);
    expect(filterQuestions([...questions], { subtopics: ["1.2 Sets"] }).map((question) => question.id)).toEqual(expect.arrayContaining([core.id, extended.id]));
  });

  it("keeps runtime/public-index metadata identical for every served row", () => {
    for (const source of raw) {
      const runtime = byId.get(source.id)!;
      const index = metadataFromRaw(source, { bank: "igcse" });
      expect(index.primaryTopic).toBe(runtime.primaryTopic);
      expect(index.secondaryTopics).toEqual(runtime.secondaryTopics);
      expect(index.subtopics).toEqual(runtime.subtopics);
      expect(index.skills).toEqual(runtime.skills);
      expect(index.officialCodeRefs ?? []).toEqual(runtime.officialCodeRefs ?? []);
      expect(displayedQuestionSubtopics(runtime)).toEqual(index.officialCodeRefs?.some((ref) => ref.startsWith("current_2025:")) ? runtime.subtopics.filter((label) => /^\d+\.\d+ /.test(label)) : [REVIEW]);
    }
  }, 60_000);
});
