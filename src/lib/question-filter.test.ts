import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { filterQuestions } from "@/lib/question-filter";
import { publicMetadataToQuestion, type PublicBankIndex } from "@/lib/question-index";
import type { UnifiedQuestion } from "@/lib/questions";

describe("main-topic-only matching", () => {
  const load = (bank: "igcse-biology-0610" | "igcse-physics-0625" | "igcse-chemistry-0620") =>
    (JSON.parse(readFileSync(join(process.cwd(), "public", "bank-index", PUBLIC_BANK_INDEX_FILES[bank]), "utf8")) as PublicBankIndex).questions
      .map((question) => publicMetadataToQuestion(question, bank));
  const biology = load("igcse-biology-0610");
  const physics = load("igcse-physics-0625");
  const chemistry = load("igcse-chemistry-0620");
  const ids = (questions: UnifiedQuestion[]) => new Set(questions.map((item) => item.id));

  // A student report: a 15-mark immunity question came up for classification because of a 2-mark part.
  it("leaves out a question that only partly covers the picked topic", () => {
    const topics = ["Characteristics and classification of living organisms"];
    expect(ids(filterQuestions(biology, { topics })).has("0610-2019-m-42-q6")).toBe(true);
    expect(ids(filterQuestions(biology, { topics, mainTopicOnly: true })).has("0610-2019-m-42-q6")).toBe(false);
  });

  it("keeps older-syllabus questions under their own topic", () => {
    const older = physics.filter((item) => item.primaryTopic === "Earlier syllabus topics" && item.secondaryTopics[0] === "Motion, forces and energy");
    expect(older.length).toBeGreaterThan(20);
    const matched = ids(filterQuestions(physics, { topics: ["Motion, forces and energy"], mainTopicOnly: true }));
    expect(older.every((item) => matched.has(item.id))).toBe(true);
  });

  it("treats earlier-syllabus and review groups as tags, not main topics", () => {
    for (const topic of ["Earlier syllabus topics", "Questions needing section review"]) {
      const all = filterQuestions(chemistry, { topics: [topic] });
      expect(all.length).toBeGreaterThan(100);
      expect(filterQuestions(chemistry, { topics: [topic], mainTopicOnly: true })).toHaveLength(all.length);
    }
  });

  it("changes nothing when no topic is picked", () => {
    expect(filterQuestions(chemistry, { mainTopicOnly: true })).toHaveLength(chemistry.length);
  });
});

const question = (id: string, code: string, facet: string): UnifiedQuestion => ({
  id, bankSlug: "ib-economics-hl", number: 1, paper: 1, year: 2024, session: "May",
  primaryTopic: "Global economy", secondaryTopics: [], skills: [], subtopics: ["Trade"], secondarySubtopics: [],
  officialCodeRefs: [code], retrievalFacets: [facet], subject: "Economics", courseEra: "new_first_assessment_2022",
  option: "", zone: "", component: "", calculator: null, marks: 5, summary: "", accessibleText: "", searchText: `${code} ${facet}`,
  questionImages: [], markschemeImages: [], questionImageCount: 0, markschemeImageCount: 0, questionAssetPaths: [], markschemeAssetPaths: [], solution: null,
  sourceQuestionUrl: null, sourceMarkSchemeUrl: null,
});

describe("Biology 0610 era-aware retrieval", () => {
  it("selecting the current official topic includes semantically equivalent historical-era questions", () => {
    const make = (id: string, primaryTopic: string): UnifiedQuestion => ({
      ...question(id, "", ""), bankSlug: "igcse-biology-0610", primaryTopic,
      subject: "Biology", courseEra: "", searchText: "",
    });
    const questions = [
      make("old", "Movement in and out of cells"),
      make("current", "Movement into and out of cells"),
      make("unrelated", "Organisation of the organism"),
    ];
    expect(filterQuestions(questions, { topics: ["Movement into and out of cells"] }).map((q) => q.id).sort()).toEqual(["current", "old"]);
  });
});

describe("Economics retrieval filters", () => {
  it("matches era-qualified official codes and additive facets independently", () => {
    const questions = [question("q1", "new_first_assessment_2022/2.1", "facet.trade-and-advantage"), question("q2", "new_first_assessment_2022/3.1", "facet.demand-and-supply")];
    expect(filterQuestions(questions, { officialCodeRefs: ["new_first_assessment_2022/2.1"] }).map((q) => q.id)).toEqual(["q1"]);
    expect(filterQuestions(questions, { retrievalFacets: ["facet.demand-and-supply"] }).map((q) => q.id)).toEqual(["q2"]);
  });
});

describe("calculator filter", () => {
  it("never treats an unknown calculator status as non-calculator", () => {
    const unknown = { ...question("unknown", "c", "f"), calculator: null };
    const none = { ...question("none", "c", "f"), calculator: false };
    const allowed = { ...question("allowed", "c", "f"), calculator: true };
    const ids = (calculator: Array<"calculator" | "non-calculator">) => filterQuestions([unknown, none, allowed], { calculator }).map((item) => item.id);
    expect(ids(["non-calculator"])).toEqual(["none"]);
    expect(ids(["calculator"])).toEqual(["allowed"]);
  });
});
