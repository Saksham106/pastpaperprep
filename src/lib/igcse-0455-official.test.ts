import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-economics-0455.json";
import official from "@/data/igcse-economics-0455-official-2026.json";
import { normalizeBankQuestions } from "@/lib/questions";
import { filterQuestions } from "@/lib/question-filter";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";
import { ECONOMICS_0455_EARLIER, project0455Sections } from "@/lib/igcse-0455-official.mjs";
import { displayedQuestionSubtopics } from "@/lib/presentation";

const source = runtime.questions;
const questions = normalizeBankQuestions("igcse-economics-0455", source, { economicsAssetMode: "private" });
const byId = new Map(questions.map((question) => [question.id, question]));

describe("0455 official 2026 section projection", () => {
  it("keeps every production ID, six topics, 39 official sections, and one honest earlier bucket", () => {
    expect(source).toHaveLength(1723);
    expect(questions).toHaveLength(source.length);
    expect(new Set(questions.map((q) => q.id))).toEqual(new Set(source.map((q) => q.id)));
    expect(official.topics).toHaveLength(6);
    expect(official.sections).toHaveLength(39);
    expect(getTopicOptions(questions)).toEqual(official.topics);
    const options = getSubtopicGroups(questions, [], []).all;
    expect(options).toEqual([...official.sections.map((section) => section.title), ECONOMICS_0455_EARLIER]);
    expect(options).not.toContain("Analysis");
    expect(options).not.toContain("Apply a definition");
    expect(options).not.toContain("concept_recognition");
  });

  it("uses era+code, never a bare legacy code, and matches SSR to the public index for all rows", () => {
    for (const raw of source) {
      const projected = project0455Sections(raw);
      const question = byId.get(raw.id)!;
      const index = metadataFromRaw(raw, { bank: "igcse-economics-0455", normalizedProduction: true });
      expect(question.subtopics).toEqual(projected.subtopics);
      expect(index.subtopics).toEqual(projected.subtopics);
      expect(question.officialCodeRefs).toEqual(projected.codeRefs);
      expect(index.officialCodeRefs).toEqual(projected.codeRefs);
      expect(question.primaryTopic).toBe(raw.primaryTopic);
      expect(index.primaryTopic).toBe(raw.primaryTopic);
      expect(question.skills).toContain(raw.subtopics[0]);
      expect(question.searchText).toContain(raw.subtopics[0].toLocaleLowerCase());
      expect(displayedQuestionSubtopics(question)).toEqual(projected.officialTitles);
    }
    expect(source.filter((q) => q.era === "2017_2019")).toHaveLength(253);
  }, 20_000);

  it("keeps old detail aliases out of student cards and PDF headings without deleting search data", () => {
    const old = source.find((raw) => raw.era === "2017_2019")!;
    const question = byId.get(old.id)!;
    expect(displayedQuestionSubtopics(question)).toEqual([ECONOMICS_0455_EARLIER]);
    expect(question.subtopics).toContain(old.subtopics[0]);
    expect(displayedQuestionSubtopics(question)).not.toContain(old.subtopics[0]);
    expect(() => displayedQuestionSubtopics({ ...question, officialCodeRefs: ["2026_2028:1.1.1"] })).toThrow(/unreviewed/);
  });

  it("returns exact source-backed section rows and leaves historical old URLs and skills searchable", () => {
    for (const section of official.sections) {
      const expected = source.filter((raw) => raw.era !== "2017_2019" && raw.officialCodes.some((ref: { official_code: string }) => ref.official_code.startsWith(section.code + ".")))
        .map((raw) => raw.id).sort();
      expect(filterQuestions([...questions], { subtopics: [section.title] }).map((q) => q.id).sort()).toEqual(expected);
      expect(getSubtopicGroups(questions, [official.topics[section.topic]], []).relevant).toContain(section.title);
    }
    expect(filterQuestions([...questions], { subtopics: [ECONOMICS_0455_EARLIER] })).toHaveLength(253);
    const old = source.find((raw) => raw.era === "2017_2019")!;
    expect(filterQuestions([...questions], { subtopics: [old.subtopics[0]] }).some((q) => q.id === old.id)).toBe(true);
    expect(filterQuestions([...questions], { search: old.subtopics[0] }).some((q) => q.id === old.id)).toBe(true);
    const skilled = source.find((raw) => raw.skills.length > 0)!;
    expect(filterQuestions([...questions], { subtopics: [skilled.skills[0]] }).some((q) => q.id === skilled.id)).toBe(true);
  });

  it("rejects missing, mismatched, or new-era codes instead of inventing ownership", () => {
    const sample = source[0];
    expect(() => project0455Sections({ ...sample, officialCodes: [] })).toThrow(/era-matched/);
    expect(() => project0455Sections({ ...sample, era: "2027_2029", courseEra: "2027_2029" })).toThrow(/era-matched|reviewed era/);
  });
});
