import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import official from "@/data/igcse-biology-0610-official-2026.json";
import { normalizeBankQuestions } from "@/lib/questions";
import { filterQuestions } from "@/lib/question-filter";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { displayedQuestionSubtopics } from "@/lib/presentation";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";
import { BIOLOGY_0610_EARLIER, BIOLOGY_0610_EARLIER_TOPIC, BIOLOGY_0610_SECTIONS, BIOLOGY_0610_TOPICS, project0610Sections } from "@/lib/igcse-0610-official.mjs";

type SourceRow = Parameters<typeof normalizeBankQuestions>[1][number] & { id: string; year: number; courseEra: string; primaryTopic: string; subtopics: string[]; secondaryTopics: string[] };
const source = (JSON.parse(readFileSync(join(process.cwd(), "src/data/production/igcse-biology-0610.json"), "utf8")) as { questions: SourceRow[] }).questions;
const questions = normalizeBankQuestions("igcse-biology-0610", source);
const byId = new Map(questions.map((question) => [question.id, question]));

describe("0610 official 2026 student projection", () => {
  it("shows the full 21-topic/61-section current map plus one compact earlier group", () => {
    expect(source).toHaveLength(4913);
    expect(BIOLOGY_0610_TOPICS).toHaveLength(21);
    expect(BIOLOGY_0610_SECTIONS).toHaveLength(61);
    expect(official.sections.map((row) => row.code)).toEqual(BIOLOGY_0610_SECTIONS.map((row) => row.code));
    expect(getTopicOptions(questions)).toEqual([...BIOLOGY_0610_TOPICS, BIOLOGY_0610_EARLIER_TOPIC]);
    const options = getSubtopicGroups(questions, [], []).all;
    expect(options).toEqual([...BIOLOGY_0610_SECTIONS.map((row) => row.title), BIOLOGY_0610_EARLIER]);
    expect(options).not.toContain("Sexual hormones in humans");
    expect(options).not.toContain("16.5");
    expect(options).not.toContain("Analysis");
    expect(getSubtopicGroups(questions, [BIOLOGY_0610_EARLIER_TOPIC], []).relevant).toEqual([BIOLOGY_0610_EARLIER]);
    expect(getSubtopicGroups(questions, [BIOLOGY_0610_TOPICS[0]], []).relevant).not.toContain(BIOLOGY_0610_EARLIER);
  });

  it("preserves all IDs and makes SSR and index project exactly the same labels and refs", () => {
    expect(new Set(questions.map((question) => question.id))).toEqual(new Set(source.map((raw) => raw.id)));
    let historical = 0;
    let extension = 0;
    for (const raw of source) {
      const projected = project0610Sections(raw);
      const question = byId.get(raw.id)!;
      const index = metadataFromRaw(raw, { bank: "igcse-biology-0610", normalizedProduction: true });
      expect(question.primaryTopic).toBe(projected.primaryTopic);
      expect(index.primaryTopic).toBe(projected.primaryTopic);
      expect(question.subtopics).toEqual(projected.subtopics);
      expect(index.subtopics).toEqual(projected.subtopics);
      expect(question.officialCodeRefs).toEqual(projected.codeRefs);
      expect(index.officialCodeRefs ?? []).toEqual(projected.codeRefs);
      expect(displayedQuestionSubtopics(question)).toEqual(projected.visibleTitles);
      expect(question.searchText).toContain(projected.aliases[0].toLocaleLowerCase());
      if (projected.historical) historical++;
      if (raw.year === 2026) { extension++; expect(projected.codeRefs.every((ref) => ref.startsWith("2026_2028:"))).toBe(true); }
    }
    expect(extension).toBe(99);
    expect(historical).toBe(624);
  }, 60_000);

  it("retrieves source-backed current sections without dropping old URL or search aliases", () => {
    for (const section of BIOLOGY_0610_SECTIONS) {
      const expected = source.filter((raw) => project0610Sections(raw).visibleTitles.includes(section.title)).map((raw) => raw.id).sort();
      expect(filterQuestions([...questions], { subtopics: [section.title] }).map((row) => row.id).sort()).toEqual(expected);
      expect(getSubtopicGroups(questions, [section.topic], []).relevant).toContain(section.title);
    }
    expect(filterQuestions([...questions], { subtopics: [BIOLOGY_0610_EARLIER] })).toHaveLength(624);
    const old = source.find((raw) => raw.courseEra === "2020_2021" && raw.subtopics.includes("Cell structure and organisation"))!;
    const question = byId.get(old.id)!;
    expect(filterQuestions([...questions], { subtopics: ["Cell structure and organisation"] }).some((row) => row.id === old.id)).toBe(true);
    expect(filterQuestions([...questions], { search: "Cell structure and organisation" }).some((row) => row.id === old.id)).toBe(true);
    expect(displayedQuestionSubtopics(question)).not.toContain("Cell structure and organisation");
  }, 60_000);

  it("fails closed on changed section identity, missing address, or reused code across eras", () => {
    const current = source.find((raw) => raw.year === 2026)!;
    expect(() => project0610Sections({ ...current, subtopics: ["99.99"] })).toThrow(/unmapped/);
    expect(() => project0610Sections({ ...current, primaryTopic: "Wrong parent" })).toThrow(/parent mismatch/);
    expect(() => project0610Sections({ ...current, subtopics: [] })).toThrow(/unreviewed missing/);
    expect(() => project0610Sections({ ...current, year: 2027 })).toThrow(/exam-year\/era mismatch/);
    const old = source.find((raw) => raw.courseEra === "2020_2021" && raw.subtopics.includes("17.2"))!;
    expect(project0610Sections(old).visibleTitles).toContain("Chromosomes, genes and proteins");
    expect(project0610Sections(old).visibleTitles).not.toContain("Mitosis");
  });
});
