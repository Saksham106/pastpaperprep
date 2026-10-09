import { describe, expect, it } from "vitest";
import { filterQuestions } from "@/lib/question-filter";
import type { UnifiedQuestion } from "@/lib/questions";

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
    const ids = (calculator: string[]) => filterQuestions([unknown, none, allowed], { calculator }).map((item) => item.id);
    expect(ids(["non-calculator"])).toEqual(["none"]);
    expect(ids(["calculator"])).toEqual(["allowed"]);
  });
});
