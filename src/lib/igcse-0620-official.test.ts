import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import official from "@/data/igcse-chemistry-0620-official-2026.json";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { filterQuestions } from "@/lib/question-filter";
import { displayedQuestionSubtopics } from "@/lib/presentation";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";
import { project0620Sections } from "@/lib/igcse-0620-official.mjs";

type SourceRow = Parameters<typeof normalizeBankQuestions>[1][number] & { id: string; year: number; primaryTopicId: string; subtopics: string[] };
const source = (JSON.parse(readFileSync(join(process.cwd(), "src/data/production/igcse-chemistry-0620.json"), "utf8")) as { questions: SourceRow[] }).questions;
const questions = normalizeBankQuestions("igcse-chemistry-0620", source);

describe("0620 official 2026 student map", () => {
  it("shows 12 official topics and all 49 numbered sections without practical skill tokens", () => {
    expect(source).toHaveLength(5129);
    expect(official.topics).toHaveLength(12);
    expect(official.sections).toHaveLength(49);
    const topics = getTopicOptions(questions);
    expect(topics.slice(0, 12)).toEqual(official.topics.map((topic) => topic.title));
    expect(topics).toContain("Earlier syllabus topics");
    expect(topics).toContain("Practical skills and investigations");
    expect(topics).toContain("Questions needing section review");
    const sections = getSubtopicGroups(questions, [], []).all;
    for (const section of official.sections) expect(sections).toContain(section.title);
    expect(sections).not.toContain("Practical.measurement");
  });

  it("keeps source and public-index parity, preserves all IDs, and isolates unresolved current rows", () => {
    expect(new Set(questions.map((question) => question.id))).toEqual(new Set(source.map((row) => row.id)));
    const byId = new Map(questions.map((question) => [question.id, question]));
    const census = { historical: 0, practical: 0, currentReview: 0, currentOnly: 0 };
    for (const raw of source) {
      const projected = project0620Sections(raw);
      const question = byId.get(raw.id)!;
      const index = metadataFromRaw(raw, { bank: "igcse-chemistry-0620", normalizedProduction: true });
      expect(question.primaryTopic).toBe(projected.primaryTopic);
      expect(index.primaryTopic).toBe(projected.primaryTopic);
      expect(question.subtopics).toEqual(projected.subtopics);
      expect(index.subtopics).toEqual(projected.subtopics);
      expect(question.officialCodeRefs).toEqual(projected.codeRefs);
      expect(index.officialCodeRefs ?? []).toEqual(projected.codeRefs);
      expect(displayedQuestionSubtopics(question)).toEqual(projected.visibleTitles);
      if (projected.practical) census.practical++;
      else if (projected.unmappedCurrent) census.currentReview++;
      else if (projected.historical) census.historical++;
      else census.currentOnly++;
      if (raw.year === 2026) expect(raw.courseEra).toBe("2023_2025");
    }
    expect(census).toEqual({ historical: 373, practical: 334, currentReview: 329, currentOnly: 4093 });
    const coded2026 = source.find((raw) => raw.year === 2026 && (raw.classificationProvenance as { officialCode?: string } | undefined)?.officialCode)!;
    const code = (coded2026.classificationProvenance as { officialCode: string }).officialCode;
    const coded2026Refs = project0620Sections(coded2026).codeRefs;
    expect(coded2026Refs).toContain(`source_recorded:2023_2025:${code}`);
    expect(coded2026Refs).toContain(`current_2026:${code}`);
    expect(coded2026Refs).not.toContain(`2023_2025:${code}`);
    expect(filterQuestions([...questions], { topics: ["Earlier syllabus topics"] })).toHaveLength(373);
    expect(filterQuestions([...questions], { topics: ["Practical skills and investigations"] })).toHaveLength(334);
    expect(filterQuestions([...questions], { subtopics: ["Current syllabus section not yet mapped"] })).toHaveLength(329);
    for (const section of official.sections) {
      const expected = source.filter((raw) => { const projected = project0620Sections(raw); return projected.visibleTitles.includes(section.title) || projected.codeRefs.includes(`alias_current:${section.code}`); }).map((raw) => raw.id).sort();
      expect(filterQuestions([...questions], { subtopics: [section.title] }).map((question) => question.id).sort()).toEqual(expected);
    }
  }, 60_000);
});
