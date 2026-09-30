import { describe, expect, it } from "vitest";
import ibBiologyHlData from "@/data/raw/ib-biology-hl.json";
import ibBiologySlData from "@/data/raw/ib-biology-sl.json";
import biology0610Runtime from "@/data/production/igcse-biology-0610.json";
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
    expect([...hl, ...sl].filter((q) => q.classificationProvenance?.status === "blocked")).toHaveLength(26);
  });

  it("keeps IB Biology and 0610 on separate official taxonomy branches", () => {
    const ib = normalizeBankQuestions("ib-biology-sl", ibBiologySlData.questions);
    const biology0610 = normalizeBankQuestions("igcse-biology-0610", (biology0610Runtime as unknown as { questions: never[] }).questions);

    expect(getTopicOptions(ib)).toEqual(expectedTopics);
    expect(getTopicOptions(biology0610)[0]).toBe("Characteristics and classification of living organisms");
    expect(getSubtopicGroups(ib, ["Molecules and cells"], []).relevant).toContain("Biological molecules and water");
    expect(getSubtopicGroups(biology0610, ["Characteristics and classification of living organisms"], []).relevant).toContain("Characteristics of living organisms");
  });

  it("uses grouped student-facing labels in teaching order and keeps blocked rows empty", () => {
    const questions = normalizeBankQuestions("ib-biology-sl", ibBiologySlData.questions);
    expect(getTopicOptions(questions)).toEqual(expectedTopics);
    expect(questions.find((q) => q.classificationProvenance?.status === "blocked")?.subtopics).toEqual([]);
    expect(questions.find((q) => q.courseEra === "bio_2025" && q.subtopics.length)?.subtopics[0]).toBeTruthy();
    expect(new Set(questions.flatMap((q) => q.subtopics))).toEqual(new Set([
      "Biological molecules and water", "Cells and ultrastructure", "Membranes and transport", "Metabolism and energy", "Nucleic acids and gene expression",
      "Digestion and nutrition", "Gas exchange and transport", "Neural and chemical signalling", "Defence against disease", "Homeostasis and reproduction",
      "DNA, genes and chromosomes", "Evolution and speciation", "Biotechnology and gene editing",
      "Populations and communities", "Adaptation and ecological niches", "Conservation and biodiversity",
    ]));
  });

  it("repairs four printed-source extension blanks without restoring HL-only codes", () => {
    const sl = normalizeBankQuestions("ib-biology-sl", ibBiologySlData.questions);
    const cases = [
      ["2019-may-tz1-sl-p1-q30", "Homeostasis and reproduction", "Organisms and body systems"],
      ["2019-may-tz1-sl-p3-q16", "Gas exchange and transport", "Organisms and body systems"],
      ["2019-may-tz2-sl-p1-q30", "Homeostasis and reproduction", "Organisms and body systems"],
      ["2019-november-tz0-sl-p3-q2", "Metabolism and energy", "Molecules and cells"],
    ] as const;
    for (const [id, label, topic] of cases) {
      const q = sl.find((row) => row.id === id);
      expect(q).toMatchObject({ primaryTopic: topic, subtopics: [label] });
      expect(q?.classificationProvenance).toMatchObject({ status: "accepted", oldSubtopics: expect.any(Array) });
      expect(sl.filter((row) => row.subtopics.includes(label)).map((row) => row.id)).toContain(id);
    }
    expect(sl.filter((q) => q.classificationProvenance?.status === "blocked")).toHaveLength(26);
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
