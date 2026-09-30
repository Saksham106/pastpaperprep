import { existsSync, readFileSync } from "node:fs";
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
  it("keeps full printed-paper provenance out of the public client projector", () => {
    const clientOverlay = readFileSync(join(process.cwd(), "src/data/igcse-physics-0625-current-review-overlay.json"), "utf8");
    expect(clientOverlay).not.toContain("https://");
    expect(clientOverlay).not.toContain("printedMSKey");
    const receiptPath = join(process.cwd(), "docs/igcse-0625-current-review-adjudication.json");
    expect(existsSync(receiptPath)).toBe(true);
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as { rows: { id: string; sourceQuestionUrl: string; sourceMarkSchemeUrl: string; qpSha256: string; msSha256: string }[] };
    expect(receipt.rows).toHaveLength(16);
    const overlay = JSON.parse(clientOverlay) as { rows: { id: string; primaryCode: string; secondaryCodes: string[] }[] };
    expect(new Set(overlay.rows.map((row) => row.id))).toEqual(new Set(receipt.rows.map((row) => row.id)));
    for (const row of receipt.rows) {
      const sourceRow = source.find((candidate) => candidate.id === row.id)!;
      expect(row.sourceQuestionUrl).toBe(sourceRow.sourceQuestionUrl);
      expect(row.sourceMarkSchemeUrl).toBe(sourceRow.sourceMarkSchemeUrl);
      expect(row.qpSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(row.msSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

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

  it("projects only the sixteen source-adjudicated 2026 review rows into their verified sections", () => {
    const expected: Record<string, [string, string[]]> = {
      "0625-2026-m-12-q1": ["1.1", []],
      "0625-2026-m-12-q3": ["1.3", []],
      "0625-2026-m-12-q13": ["2.1.3", []],
      "0625-2026-m-22-q1": ["1.1", []],
      "0625-2026-m-32-q2": ["1.1", ["1.5.1", "1.3"]],
      "0625-2026-s-11-q1": ["1.1", []],
      "0625-2026-s-11-q3": ["1.2", []],
      "0625-2026-s-11-q12": ["2.1.3", []],
      "0625-2026-s-12-q1": ["1.1", []],
      "0625-2026-s-12-q12": ["2.1.3", []],
      "0625-2026-s-13-q1": ["1.1", []],
      "0625-2026-s-13-q12": ["2.1.3", []],
      "0625-2026-s-21-q1": ["1.1", []],
      "0625-2026-s-22-q1": ["1.1", []],
      "0625-2026-s-23-q1": ["1.1", []],
      "0625-2026-s-31-q2": ["1.1", ["1.4"]],
    };
    expect(Object.keys(expected)).toHaveLength(16);
    for (const [id, [primaryCode, secondaryCodes]] of Object.entries(expected)) {
      const raw = source.find((row) => row.id === id)!;
      expect(raw.year).toBe(2026);
      expect((raw.classificationProvenance as { officialCode?: string | null } | undefined)?.officialCode ?? null).toBeNull();
      const projected = project0625Sections(raw);
      expect(projected.unmappedCurrent).toBe(false);
      expect(projected.codeRefs).toContain(`review_verified_2026:${primaryCode}`);
      for (const code of [primaryCode, ...secondaryCodes]) {
        const title = official.sections.find((section) => section.code === code)!.title;
        expect(projected.codeRefs).toContain(`current_2026:${code}`);
        expect(projected.visibleTitles).toContain(title);
        expect(filterQuestions([...questions], { subtopics: [title] }).some((question) => question.id === id)).toBe(true);
      }
      expect(projected.codeRefs).not.toContain("unresolved:current");
    }
    expect(filterQuestions([...questions], { subtopics: ["Current syllabus section not yet mapped"] })).toHaveLength(0);
    expect(getTopicOptions(questions)).not.toContain("Questions needing section review");
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
    expect(filterQuestions([...questions], { subtopics: ["Current syllabus section not yet mapped"] })).toHaveLength(0);
    const olderId = source.find((raw) => raw.courseEra === "2020_2022" && project0625Sections(raw).historical && official.topics.some((topic) => topic.title === raw.primaryTopic))!.id;
    const olderQuestion = byId.get(olderId)!;
    // A pre-projection topic URL still reaches older questions under that broad topic;
    // official section filters cannot silently claim a historical-only row.
    const oldTopic = source.find((raw) => raw.id === olderId)!.primaryTopic!;
    expect(filterQuestions([olderQuestion], { topics: [oldTopic] })).toHaveLength(1);
    expect(filterQuestions([olderQuestion], { subtopics: [official.sections[0].title] })).toHaveLength(0);
  }, 60_000);
});
