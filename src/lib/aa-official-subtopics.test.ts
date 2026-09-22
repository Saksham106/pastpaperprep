import { describe, expect, it } from "vitest";
import { filterQuestions } from "@/lib/question-filter";
import { getSubtopicGroups } from "@/lib/taxonomy-router";
import { normalizeBankQuestions } from "@/lib/questions";
import type { UnifiedQuestion } from "@/lib/questions";
import rawSl from "@/data/raw/ib-sl.json";
import rawHl from "@/data/raw/ib-hl.json";
import aaOverlay from "@/data/aa-official-subtopics/overlay.json";
import aaReport from "@/data/aa-official-subtopics/report.json";
import granularOverlay from "@/data/math-granular-label-overlay.json";

const raw = {
  id: "m26-math-aasl-p1-tza-q4",
  subject: "Mathematics: analysis and approaches SL",
  courseEra: "aa-sl",
  primaryTopic: "Number and algebra",
  secondaryTopics: ["Functions"],
  skills: ["old skill"],
  subtopics: ["old skill"],
  detailedSubtopics: [],
  questionImages: [],
  markschemeImages: [],
  year: 2026,
  paper: 1,
  number: 1,
  session: "may",
  component: "P1",
  marks: 5,
};

const minimal = (overrides: Partial<UnifiedQuestion>): UnifiedQuestion => ({
  id: "q",
  bankSlug: "ib-sl",
  number: 1,
  paper: 1,
  year: 2026,
  session: "may",
  primaryTopic: "Number and algebra",
  secondaryTopics: [],
  skills: [],
  subtopics: [],
  secondarySubtopics: [],
  subject: "Mathematics: analysis and approaches SL",
  courseEra: "aa-sl",
  option: "",
  zone: "",
  component: "P1",
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
  ...overrides,
});

describe("official AA normal subtopics", () => {
  it("promotes reviewed labels while preserving old classification as provenance", () => {
    const question = normalizeBankQuestions("ib-sl", [raw] as never)[0];
    expect(question.subtopics).toContain("Standard form and orders of magnitude");
    expect(question.primaryTopic).toBe("Number and algebra");
    expect(question.granularLabels).toEqual([]);
    expect(question.classificationProvenance?.oldSubtopics).toEqual(["Number systems and notation", "Sequences and series"]);
  });

  it("composes official subtopic and secondary-topic filtering", () => {
    const question = minimal({
      id: "q1",
      primaryTopic: "Calculus",
      secondaryTopics: ["Number and algebra"],
      subtopics: ["Differentiation and tangents"],
    });
    expect(filterQuestions([question], { topics: ["Number and algebra"], subtopics: ["Differentiation and tangents"] })).toHaveLength(1);
    const groups = getSubtopicGroups([question], ["Calculus"], []);
    expect(groups.relevant).toEqual(["Differentiation and tangents"]);
  });

  it("covers exactly the current AA universe and keeps legacy granular assignments", () => {
    const sl = normalizeBankQuestions("ib-sl", (rawSl as { questions: unknown[] }).questions as never[]);
    const hl = normalizeBankQuestions("ib-hl", (rawHl as { questions: unknown[] }).questions as never[]);
    const currentSl = new Set(aaOverlay.records.filter((row) => row.level === "SL").map((row) => row.id));
    const currentHl = new Set(aaOverlay.records.filter((row) => row.level === "HL").map((row) => row.id));
    expect(sl.filter((row) => currentSl.has(row.id))).toHaveLength(378);
    expect(hl.filter((row) => currentHl.has(row.id))).toHaveLength(489);
    expect(aaOverlay.records.filter((row) => row.status === "accepted")).toHaveLength(858);
    expect(aaOverlay.records.filter((row) => row.status === "blocked")).toHaveLength(9);
    expect(aaReport.counts.primaryTopicCorrections).toBe(35);
    expect(aaReport.counts.crossTopicRows).toBe(2);
    expect([...sl, ...hl].filter((question) => question.classificationProvenance?.legacyGranularLabels.length).length).toBe(69);
    for (const question of [...sl, ...hl]) {
      if (currentSl.has(question.id) || currentHl.has(question.id)) expect(question.granularLabels).toEqual([]);
    }
    const legacyExpected = new Map(granularOverlay.labels.map((row) => [`${row.bank}:${row.id}`, row.label]));
    for (const question of [...sl, ...hl]) {
      if (currentSl.has(question.id) || currentHl.has(question.id)) continue;
      const bank = question.bankSlug === "ib-sl" ? "ib-aa-sl" : "ib-aa-hl";
      const labels = granularOverlay.labels.filter((row) => row.bank === bank && row.id === question.id).map((row) => row.label);
      expect(question.granularLabels).toEqual(labels);
    }
    expect(legacyExpected.size).toBeGreaterThan(0);
  });
});
