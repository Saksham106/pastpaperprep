import { describe, expect, it } from "vitest";
import { filterQuestions } from "@/lib/question-filter";
import { parseExplorerState, serializeExplorerState } from "@/lib/explorer-state";
import { formatPublicLabel } from "@/lib/presentation";
import type { UnifiedQuestion } from "@/lib/questions";

const question = (id: string, granularLabels: string[], primaryTopic = "Functions"): UnifiedQuestion => ({
  id,
  bankSlug: "ib-hl",
  number: 1,
  paper: 1,
  year: 2025,
  session: "may",
  primaryTopic,
  secondaryTopics: [],
  skills: ["Algebra"],
  subtopics: ["Algebra"],
  secondarySubtopics: [],
  granularLabels,
  subject: "Mathematics",
  courseEra: "",
  option: "",
  zone: "",
  component: "",
  calculator: false,
  marks: 1,
  summary: "",
  accessibleText: "",
  searchText: "",
  questionImages: [],
  markschemeImages: [],
  questionImageCount: 0,
  markschemeImageCount: 0,
  questionAssetPaths: [],
  markschemeAssetPaths: [],
  solution: null,
  sourceQuestionUrl: null,
  sourceMarkSchemeUrl: null,
});

describe("math granular labels", () => {
  it("filters by granular label and composes with topic filters", () => {
    const questions = [question("a", ["math.aa.functions.domain-range-restrictions"]), question("b", ["math.aa.calculus.related-rates"], "Calculus")];
    expect(filterQuestions(questions, { granularLabels: ["math.aa.functions.domain-range-restrictions"] }).map(({ id }) => id)).toEqual(["a"]);
    expect(filterQuestions(questions, { topics: ["Functions"], granularLabels: ["math.aa.functions.domain-range-restrictions"] }).map(({ id }) => id)).toEqual(["a"]);
    expect(filterQuestions(questions, { topics: ["Calculus"], granularLabels: ["math.aa.functions.domain-range-restrictions"] })).toEqual([]);
  });

  it("shows student-facing names while keeping stable IDs in filter state", () => {
    expect(formatPublicLabel("math.aa.functions.domain-range-restrictions")).toBe("Domain, range and restrictions");
    expect(formatPublicLabel("math.ai.statistics-probability.quartiles-box-plots-cumulative-frequency")).toBe("Quartiles, box plots and cumulative frequency");
  });

  it("round-trips granular-label filter state in the share URL", () => {
    const state = parseExplorerState({ granularLabel: ["math.aa.calculus.related-rates"], topic: "Calculus" });
    expect(state.filters).toEqual({ granularLabels: ["math.aa.calculus.related-rates"], topics: ["Calculus"] });
    expect([...serializeExplorerState(state).entries()]).toEqual([
      ["topic", "Calculus"],
      ["granularLabel", "math.aa.calculus.related-rates"],
    ]);
  });
});
