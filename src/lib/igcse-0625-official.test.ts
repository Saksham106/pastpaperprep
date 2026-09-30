import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import official from "@/data/igcse-physics-0625-official-2026.json";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { filterQuestions } from "@/lib/question-filter";
import { displayedQuestionSubtopics } from "@/lib/presentation";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";
import { project0625Sections } from "@/lib/igcse-0625-official.mjs";

type SourceRow = Parameters<typeof normalizeBankQuestions>[1][number] & { id: string; courseEra: string; primaryTopic: string | null; subtopics: string[] };
const source = (JSON.parse(readFileSync(join(process.cwd(), "src/data/production/igcse-physics-0625.json"), "utf8")) as { questions: SourceRow[] }).questions;
const questions = normalizeBankQuestions("igcse-physics-0625", source);

describe("0625 official 2026 student map", () => {
  it("shows all six official topics and their 71 distinct numbered section headings", () => {
    expect(source).toHaveLength(5789);
    expect(official.topics).toHaveLength(6);
    expect(official.sections).toHaveLength(71);
    const options = getTopicOptions(questions);
    expect(options.slice(0, 6)).toEqual(official.topics.map((topic) => topic.title));
    expect(options).toContain("Earlier syllabus topics");
    expect(options).toContain("Experimental skills and investigations");
    const sections = getSubtopicGroups(questions, [], []).all;
    for (const section of official.sections) expect(sections).toContain(section.title);
    expect(sections).not.toContain("Practical.measurement");
    expect(sections).not.toContain("Practical.graph-interp");
    // Practical is a separate topic, not a numbered content section. Its old
    // subtopic token remains filterable without posing as a syllabus heading.
    expect(sections).not.toContain("Experimental skills and investigations");
    expect(getSubtopicGroups(questions, ["Experimental skills and investigations"], []).relevant).toEqual([]);
    const legacyPracticalIds = source.filter((raw) => raw.primaryTopicId === "practical-skills" && raw.subtopics.includes("Experimental skills and investigations")).map((raw) => raw.id).sort();
    expect(filterQuestions([...questions], { topics: ["Experimental skills and investigations"], subtopics: ["Experimental skills and investigations"] }).map((question) => question.id).sort()).toEqual(legacyPracticalIds);
  });

  it("keeps all 5,789 IDs and projects SSR/index/filter and card headings identically", () => {
    expect(new Set(questions.map((question) => question.id))).toEqual(new Set(source.map((row) => row.id)));
    const byId = new Map(questions.map((question) => [question.id, question]));
    for (const raw of source) {
      const projected = project0625Sections(raw);
      const question = byId.get(raw.id)!;
      const index = metadataFromRaw(raw, { bank: "igcse-physics-0625", normalizedProduction: true });
      expect(question.primaryTopic).toBe(projected.primaryTopic);
      expect(index.primaryTopic).toBe(projected.primaryTopic);
      expect(question.subtopics).toEqual(projected.subtopics);
      expect(index.subtopics).toEqual(projected.subtopics);
      expect(question.officialCodeRefs).toEqual(projected.codeRefs);
      expect(index.officialCodeRefs ?? []).toEqual(projected.codeRefs);
      expect(displayedQuestionSubtopics(question)).toEqual(projected.visibleTitles);
    }
    for (const section of official.sections) {
      const expected = source.filter((raw) => project0625Sections(raw).visibleTitles.includes(section.title)).map((raw) => raw.id).sort();
      expect(filterQuestions([...questions], { subtopics: [section.title] }).map((question) => question.id).sort()).toEqual(expected);
    }
    expect(filterQuestions([...questions], { topics: ["Earlier syllabus topics"] })).toHaveLength(1309);
    expect(filterQuestions([...questions], { topics: ["Experimental skills and investigations"] })).toHaveLength(424);
    expect(filterQuestions([...questions], { subtopics: ["Current syllabus section not yet mapped"] })).toHaveLength(16);
    const olderId = source.find((raw) => raw.courseEra === "2020_2022" && project0625Sections(raw).historical && official.topics.some((topic) => topic.title === raw.primaryTopic))!.id;
    const olderQuestion = byId.get(olderId)!;
    // A pre-projection topic URL still reaches older questions under that broad topic;
    // official section filters cannot silently claim a historical-only row.
    const oldTopic = source.find((raw) => raw.id === olderId)!.primaryTopic!;
    expect(filterQuestions([olderQuestion], { topics: [oldTopic] })).toHaveLength(1);
    expect(filterQuestions([olderQuestion], { subtopics: [official.sections[0].title] })).toHaveLength(0);
  }, 60_000);
});
