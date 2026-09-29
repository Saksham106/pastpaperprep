import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import official from "@/data/igcse-coordinated-sciences-0654-official-2025.json";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { project0654Sections } from "@/lib/igcse-0654-official.mjs";
import { filterQuestions } from "@/lib/question-filter";
import { displayedQuestionSubtopics } from "@/lib/presentation";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";

type SourceRow = Parameters<typeof normalizeBankQuestions>[1][number] & { id: string; courseEra: string; primaryTopic: string; subtopics: string[] };
const source = (JSON.parse(readFileSync(join(process.cwd(), "src/data/production/igcse-coordinated-sciences-0654.json"), "utf8")) as { questions: SourceRow[] }).questions;
const questions = normalizeBankQuestions("igcse-coordinated-sciences-0654", source);

describe("0654 official 2025 student hierarchy", () => {
  it("exposes all 37 official topics, with older-only and practical content compactly separate", () => {
    expect(source).toHaveLength(4721);
    expect(new Set(questions.map((question) => question.id))).toEqual(new Set(source.map((row) => row.id)));
    expect(official.topics).toHaveLength(37);
    expect(official.sections).toHaveLength(112);
    const options = getTopicOptions(questions);
    expect(options.slice(0, 37)).toEqual(official.topics.map((topic) => topic.title));
    expect(options).toContain("Earlier syllabus topics");
    expect(options).toContain("Practical skills and investigations");
    expect(options).not.toContain("Sulfur");
    expect(options).not.toContain("Carbonates");
  });

  it("maps finer 2025 objective codes to their printed parent section, not an invented section", () => {
    for (const id of ["0654-2025-summer-11-q30", "0654-2025-march-12-q31"]) {
      const row = source.find((item) => item.id === id)!;
      expect(row.courseEra).toBe("new_2025");
      expect(row.subtopics).toHaveLength(1);
      expect(project0654Sections(row).visibleTitles).toEqual(row.subtopics);
    }
  });

  it("keeps distinct official Biology and Chemistry Diffusion sections and hides skills", () => {
    const sections = getSubtopicGroups(questions, [], []).all;
    expect(sections).toContain("Diffusion (Biology)");
    expect(sections).toContain("Diffusion (Chemistry)");
    expect(sections).not.toContain("Diffusion");
    expect(sections).not.toContain("measurement");
    expect(sections).not.toContain("Electrical quantities continued");
  });

  it("does not silently move an old-era heading into a different current topic based on title alone", () => {
    const old = source.find((row) => row.id === "0654-2024-march-12-q14")!;
    expect(old.primaryTopic).toBe("Atoms, elements and compounds");
    expect(project0654Sections(old).visibleTitles).toContain("Earlier syllabus content");
    expect(project0654Sections(old).visibleTitles).not.toContain("Physical and chemical changes");
  });

  it("matches each official section by projection without losing original search aliases", () => {
    const byId = new Map(questions.map((question) => [question.id, question]));
    for (const raw of source) {
      const projected = project0654Sections(raw);
      const question = byId.get(raw.id)!;
      const index = metadataFromRaw(raw, { bank: "igcse-coordinated-sciences-0654", normalizedProduction: true });
      expect(question.primaryTopic).toBe(projected.primaryTopic);
      expect(index.primaryTopic).toBe(projected.primaryTopic);
      expect(question.subtopics).toEqual(projected.subtopics);
      expect(index.subtopics).toEqual(projected.subtopics);
      expect(question.officialCodeRefs).toEqual(projected.codeRefs);
      expect(index.officialCodeRefs ?? []).toEqual(projected.codeRefs);
      expect(displayedQuestionSubtopics(question)).toEqual(projected.visibleTitles);
    }
    for (const section of official.sections) {
      const label = section.title === "Diffusion" ? `Diffusion (${section.subject === "B" ? "Biology" : "Chemistry"})` : section.title;
      const expected = source.filter((raw) => project0654Sections(raw).visibleTitles.includes(label)).map((raw) => raw.id).sort();
      expect(filterQuestions([...questions], { subtopics: [label] }).map((question) => question.id).sort()).toEqual(expected);
    }
    const earlier = source.find((raw) => project0654Sections(raw).historical && raw.subtopics.length)!;
    expect(filterQuestions([...questions], { search: earlier.subtopics[0] }).some((question) => question.id === earlier.id)).toBe(true);
    expect(filterQuestions([...questions], { subtopics: ["Earlier syllabus content"] })).toHaveLength(source.filter((raw) => project0654Sections(raw).historical).length);
    expect(filterQuestions([...questions], { topics: ["Earlier syllabus topics"] })).toHaveLength(source.filter((raw) => project0654Sections(raw).historical).length);
    expect(filterQuestions([...questions], { topics: ["Practical skills and investigations"] })).toHaveLength(55);
    const practical = source.find((raw) => project0654Sections(raw).practical)!;
    expect(filterQuestions([...questions], { subtopics: [practical.subtopics[0]] }).some((question) => question.id === practical.id)).toBe(true);
  }, 60_000);
});
