import { describe, expect, it } from "vitest";
import ibBiologyHlData from "@/data/raw/ib-biology-hl.json";
import ibBiologySlData from "@/data/raw/ib-biology-sl.json";
import biology0610Runtime from "@/data/production/igcse-biology-0610.json";
import { normalizeBankQuestions } from "@/lib/questions";
import { filterQuestions } from "@/lib/question-filter";
import hlArchive from "@/data/paper-archives/ib-biology-hl.json";
import slArchive from "@/data/paper-archives/ib-biology-sl.json";
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
    expect(hl).toHaveLength(2071);
    expect(sl).toHaveLength(1671);
    expect(hl.filter((q) => q.courseEra === "bio_2016")).toHaveLength(1642);
    expect(hl.filter((q) => q.courseEra === "bio_2025")).toHaveLength(430);
    expect(sl.filter((q) => q.courseEra === "bio_2016")).toHaveLength(1341);
    expect(sl.filter((q) => q.courseEra === "bio_2025")).toHaveLength(330);
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
      "DNA, genes and chromosomes", "Cell division and inheritance", "Evolution and speciation", "Diversity and classification", "Biotechnology and gene editing",
      "Populations and communities", "Energy and matter cycles", "Adaptation and ecological niches", "Conservation and biodiversity", "Climate change and ecosystem stability",
    ]));
    // Muscle and movement is HL-only material; no SL question is reviewed into it.
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

  it("files the printed-source triglyceride question under biological molecules, not nucleic acids", () => {
    const sl = normalizeBankQuestions("ib-biology-sl", ibBiologySlData.questions);
    const q = sl.find((row) => row.id === "2025-may-tz3-sl-p2-q2");
    expect(q?.primaryTopic).toBe("Molecules and cells");
    expect(q?.subtopics).toEqual(["Biological molecules and water"]);
    const found = filterQuestions(sl, { topics: ["Molecules and cells"], subtopics: ["Biological molecules and water"] });
    expect(found.map((row) => row.id)).toContain("2025-may-tz3-sl-p2-q2");
    expect(filterQuestions(sl, { subtopics: ["Nucleic acids and gene expression"] }).map((row) => row.id)).not.toContain("2025-may-tz3-sl-p2-q2");
  });

  it("full-paper reports recommend the same topics as topic practice", () => {
    for (const [slug, data, archive] of [["ib-biology-hl", ibBiologyHlData, hlArchive], ["ib-biology-sl", ibBiologySlData, slArchive]] as const) {
      const byId = new Map(normalizeBankQuestions(slug, data.questions).map((q) => [q.id, q]));
      for (const paper of archive.papers) {
        for (const q of paper.questions) {
          const row = byId.get(q.id)!;
          expect(q.topics, q.id).toEqual([...new Set([row.primaryTopic, ...row.secondaryTopics])]);
        }
      }
    }
    const community = slArchive.papers.find((p) => p.summary.id === "biology-2022-may-tz1-sl-p1-english")!.questions.find((q) => q.id === "2022-may-tz1-sl-p1-q17");
    expect(community?.topics).toEqual(["Populations, ecosystems and environmental change"]);
  });

  it("retrieves the printed-source corrections from the #286 review", () => {
    const sl = normalizeBankQuestions("ib-biology-sl", ibBiologySlData.questions);
    const hl = normalizeBankQuestions("ib-biology-hl", ibBiologyHlData.questions);
    // 2021 SL P2 Q5(c) is a 3-mark autosomal recessive cross.
    expect(filterQuestions(sl, { subtopics: ["Cell division and inheritance"] }).map((q) => q.id)).toContain("2021-may-tz2-sl-p2-q5");
    // 2024 HL P3 Q2 assesses osmolarity and osmosis only; bacterial density is just a graph variable.
    const osmosis = hl.find((q) => q.id === "2024-may-tz2-hl-p3-q2")!;
    expect(osmosis.subtopics).toEqual(["Membranes and transport"]);
    expect(filterQuestions(hl, { topics: ["Populations, ecosystems and environmental change"] }).map((q) => q.id)).not.toContain("2024-may-tz2-hl-p3-q2");
  });
});
