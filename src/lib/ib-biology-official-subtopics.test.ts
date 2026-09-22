import { describe, expect, it } from "vitest";
import ibBiologyHlData from "@/data/raw/ib-biology-hl.json";
import ibBiologySlData from "@/data/raw/ib-biology-sl.json";
import { normalizeBankQuestions } from "@/lib/questions";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";

const expectedTopics = [
  "Molecules and cells",
  "Organisms and body systems",
  "Information, inheritance and evolution",
  "Populations, ecosystems and environmental change",
];

describe("IB Biology official syllabus subtopics", () => {
  it("routes both eras and preserves the exact reviewed scope", () => {
    const hl = normalizeBankQuestions("ib-biology-hl", ibBiologyHlData.questions);
    const sl = normalizeBankQuestions("ib-biology-sl", ibBiologySlData.questions);
    expect(hl).toHaveLength(1911);
    expect(sl).toHaveLength(1548);
    expect(hl.filter((q) => q.courseEra === "bio_2016")).toHaveLength(1642);
    expect(hl.filter((q) => q.courseEra === "bio_2025")).toHaveLength(269);
    expect(sl.filter((q) => q.courseEra === "bio_2016")).toHaveLength(1341);
    expect(sl.filter((q) => q.courseEra === "bio_2025")).toHaveLength(207);
    expect([...hl, ...sl].filter((q) => q.classificationProvenance?.status === "blocked")).toHaveLength(30);
  });

  it("uses grouped student-facing labels in teaching order and keeps blocked rows empty", () => {
    const questions = normalizeBankQuestions("ib-biology-sl", ibBiologySlData.questions);
    expect(getTopicOptions(questions)).toEqual(expectedTopics);
    expect(questions.find((q) => q.classificationProvenance?.status === "blocked")?.subtopics).toEqual([]);
    expect(questions.find((q) => q.courseEra === "bio_2025" && q.subtopics.length)?.subtopics[0]).toBeTruthy();
    expect(new Set(questions.flatMap((q) => q.subtopics))).toEqual(new Set([
      "Biological molecules and water", "Cells and ultrastructure", "Membranes and transport", "Metabolism and energy", "Nucleic acids and gene expression",
      "Digestion and nutrition", "Gas exchange and transport", "Neural and chemical signalling", "Defence against disease",
      "DNA, genes and chromosomes", "Evolution and speciation", "Biotechnology and gene editing",
      "Populations and communities", "Adaptation and ecological niches", "Conservation and biodiversity",
    ]));
  });

  it("composes topic/subtopic retrieval and keeps old labels only in provenance", () => {
    const questions = normalizeBankQuestions("ib-biology-hl", ibBiologyHlData.questions);
    const grouped = getSubtopicGroups(questions, ["Molecules and cells"], []);
    expect(grouped.relevant).toContain("Biological molecules and water");
    const row = questions.find((q) => q.classificationProvenance?.oldSubtopics.length && q.subtopics.join("|") !== q.classificationProvenance.oldSubtopics.join("|"));
    expect(row?.classificationProvenance?.oldSubtopics.length).toBeGreaterThan(0);
    expect(row?.subtopics).not.toEqual(row?.classificationProvenance?.oldSubtopics);
  });
});
