import { describe, expect, it } from "vitest";
import { filterQuestions } from "@/lib/question-filter";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import type { UnifiedQuestion } from "@/lib/questions";

const row = (id: string, topic: string, subtopic: string): UnifiedQuestion => ({
  id, bankSlug: "igcse-biology-0610", number: 1, paper: 1, year: 2021, session: "June",
  primaryTopic: topic, secondaryTopics: [], subtopics: subtopic ? [subtopic] : [],
  skills: [], secondarySubtopics: [], subject: "Biology", courseEra: "2020_2021",
  option: "", zone: "", component: "11", calculator: null, marks: 1,
  summary: "", accessibleText: "", searchText: "", questionImages: [], markschemeImages: [],
  questionImageCount: 0, markschemeImageCount: 0, questionAssetPaths: [], markschemeAssetPaths: [],
  solution: null, sourceQuestionUrl: null, sourceMarkSchemeUrl: null,
});

describe("0610 syllabus-first topic filters", () => {
  it("shows one current official topic for equivalent historical topic names", () => {
    const questions = [
      row("old", "Movement in and out of cells", "Diffusion"),
      row("current", "Movement into and out of cells", "Osmosis"),
      row("old-biotech", "Biotechnology and genetic engineering", "Genetic engineering"),
      row("new-biotech", "Biotechnology and genetic modification", "Genetic modification"),
    ];
    expect(getTopicOptions(questions)).toEqual([
      "Movement into and out of cells",
      "Biotechnology and genetic modification",
    ]);
    expect(filterQuestions(questions, { topics: ["Movement into and out of cells"] }).map((q) => q.id).sort())
      .toEqual(["current", "old"]);
  });

  it("offers old and current question-bearing subtopics inside the selected current topic", () => {
    const questions = [
      row("old", "Movement in and out of cells", "Diffusion"),
      row("current", "Movement into and out of cells", "Osmosis"),
    ];
    const groups = getSubtopicGroups(questions, ["Movement into and out of cells"], []);
    expect(groups.relevant).toEqual(expect.arrayContaining(["Diffusion", "Osmosis"]));
    expect(filterQuestions(questions, { topics: ["Movement into and out of cells"], subtopics: ["Diffusion"] }).map((q) => q.id))
      .toEqual(["old"]);
  });

  it("retains a historical-only subtopic as a usable filter under its current parent", () => {
    const questions = [
      row("old", "Biotechnology and genetic engineering", "Genetic engineering"),
      row("current", "Biotechnology and genetic modification", "Genetic modification"),
    ];
    const topic = "Biotechnology and genetic modification";
    expect(getSubtopicGroups(questions, [topic], []).relevant).toContain("Genetic engineering");
    expect(filterQuestions(questions, { topics: [topic], subtopics: ["Genetic engineering"] }).map((q) => q.id))
      .toEqual(["old"]);
  });

  it("moves source subtopic headings out of the top-level menu without losing their questions", () => {
    const questions = [
      row("size", "Size of specimens", ""),
      row("habitat", "Habitat destruction", ""),
      row("genetic", "Genetic modification", ""),
    ];
    expect(getTopicOptions(questions)).toEqual([
      "Organisation of the organism",
      "Human influences on ecosystems",
      "Biotechnology and genetic modification",
    ]);
    expect(filterQuestions(questions, { topics: ["Organisation of the organism"] }).map((q) => q.id))
      .toEqual(["size"]);
    expect(filterQuestions(questions, { topics: ["Human influences on ecosystems"] }).map((q) => q.id))
      .toEqual(["habitat"]);
    expect(filterQuestions(questions, { topics: ["Biotechnology and genetic modification"] }).map((q) => q.id))
      .toEqual(["genetic"]);
  });
});
