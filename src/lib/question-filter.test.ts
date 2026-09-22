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

describe("Economics retrieval filters", () => {
  it("matches era-qualified official codes and additive facets independently", () => {
    const questions = [question("q1", "new_first_assessment_2022/2.1", "facet.trade-and-advantage"), question("q2", "new_first_assessment_2022/3.1", "facet.demand-and-supply")];
    expect(filterQuestions(questions, { officialCodeRefs: ["new_first_assessment_2022/2.1"] }).map((q) => q.id)).toEqual(["q1"]);
    expect(filterQuestions(questions, { retrievalFacets: ["facet.demand-and-supply"] }).map((q) => q.id)).toEqual(["q2"]);
  });
});
