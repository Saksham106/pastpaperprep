import { describe, expect, it } from "vitest";
import { filterQuestions } from "@/lib/question-filter";
import { getSubtopicGroups, getTopicOptions } from "@/lib/taxonomy-router";
import { normalizeBankQuestions } from "@/lib/questions";
import type { UnifiedQuestion } from "@/lib/questions";
import rawSl from "@/data/raw/ib-sl.json";
import rawHl from "@/data/raw/ib-hl.json";
import aaOverlay from "@/data/aa-official-subtopics/overlay.json";
import aaReport from "@/data/aa-official-subtopics/report.json";
import granularOverlay from "@/data/math-granular-label-overlay.json";
import aaItems from "@/data/aa-official-subtopics/items.json";
import aaTaxonomy from "@/data/aa-official-subtopics/taxonomy.json";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { toPublicQuestionMetadata, type PublicBankIndex } from "@/lib/question-index";
import { metadataFromRaw } from "../../scripts/generate-bank-index.mjs";
import { derivedItems, isSingleItemRecord, unionItems } from "../../scripts/aa/official-items.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raw = {
  id: "2026-may-p1-tz1-q4",
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
    expect(question.classificationProvenance?.oldSubtopics).toEqual(["Sequences and series", "Number systems and notation"]);
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

  it("keeps legacy AA rows filterable while current rows use official taxonomy", () => {
    const sl = normalizeBankQuestions("ib-sl", (rawSl as { questions: unknown[] }).questions as never[]);
    const hl = normalizeBankQuestions("ib-hl", (rawHl as { questions: unknown[] }).questions as never[]);
    for (const bank of [sl, hl]) {
      const legacy = bank.filter((question) => !question.classificationProvenance);
      const current = bank.filter((question) => Boolean(question.classificationProvenance));
      const groups = getSubtopicGroups(bank, [], []);
      expect(legacy).not.toHaveLength(0);
      expect(current).not.toHaveLength(0);
      for (const question of legacy) {
        for (const subtopic of question.subtopics) {
          expect(filterQuestions(bank, { subtopics: [subtopic] })).toContainEqual(question);
        }
        for (const label of question.granularLabels ?? []) {
          expect(filterQuestions(bank, { granularLabels: [label] })).toContainEqual(question);
        }
      }
      expect(groups.all).toEqual(expect.arrayContaining(legacy.flatMap((question) => question.subtopics)));
      expect(groups.all).toEqual(expect.arrayContaining(current.flatMap((question) => question.subtopics)));
      expect(getTopicOptions(bank).slice(0, 5)).toEqual([
        "Number and algebra",
        "Functions",
        "Geometry and trigonometry",
        "Statistics and probability",
        "Calculus",
      ]);
    }
  });

  it("repairs only the three printed-source AA SL blanks, retaining rejected labels as history", () => {
    const sl = normalizeBankQuestions("ib-sl", (rawSl as { questions: unknown[] }).questions as never[]);
    const ids = ["2023-november-p1-tz2-q2", "2023-november-p2-tz1-q7", "2023-november-p2-tz2-q7"];
    const rows = ids.map((id) => sl.find((row) => row.id === id) ?? (() => { throw new Error(id); })());
    expect(rows[0]).toMatchObject({ primaryTopic: "Functions", subtopics: ["Composite and inverse functions"] });
    for (const row of rows.slice(1)) {
      expect(row).toMatchObject({ primaryTopic: "Calculus", secondaryTopics: ["Geometry and trigonometry"], subtopics: ["Second derivatives, optimization and kinematics", "Three-dimensional measurement and angles"] });
      expect(row.subtopics).not.toContain("Radians, arc length and sector area");
      for (const label of row.subtopics) expect(filterQuestions(sl, { subtopics: [label] })).toContainEqual(row);
    }
    for (const row of rows) {
      expect(row.classificationProvenance?.status).toBe("accepted");
      expect(row.classificationProvenance?.oldSubtopics.length).toBeGreaterThan(0);
    }
    expect(aaOverlay.records.filter((record) => record.level === "SL" && record.status === "blocked")).toHaveLength(0);
    expect(aaOverlay.records.filter((record) => record.level === "HL" && record.status === "blocked")).toHaveLength(3);
  });

  it("covers exactly the current AA universe and keeps legacy granular assignments", () => {
    const sl = normalizeBankQuestions("ib-sl", (rawSl as { questions: unknown[] }).questions as never[]);
    const hl = normalizeBankQuestions("ib-hl", (rawHl as { questions: unknown[] }).questions as never[]);
    const currentSl = new Set(aaOverlay.records.filter((row) => row.level === "SL").map((row) => row.id));
    const currentHl = new Set(aaOverlay.records.filter((row) => row.level === "HL").map((row) => row.id));
    expect(sl.filter((row) => currentSl.has(row.id))).toHaveLength(396);
    expect(hl.filter((row) => currentHl.has(row.id))).toHaveLength(541);
    expect(aaOverlay.records.filter((row) => row.status === "accepted")).toHaveLength(934);
    expect(aaOverlay.records.filter((row) => row.status === "blocked")).toHaveLength(3);
    expect(aaReport.counts.primaryTopicCorrections).toBe(35);
    expect(aaReport.counts.crossTopicRows).toBe(2);
    expect([...sl, ...hl].filter((question) => question.classificationProvenance?.legacyGranularLabels.length).length).toBe(66);
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

  it("retrieves reviewed assessed facets of May 2026 HL questions", () => {
    const hl = normalizeBankQuestions("ib-hl", (rawHl as { questions: unknown[] }).questions as never[]);
    const cases = [
      ["2026-may-tz2-p3-q2", "Geometry and trigonometry", "Three-dimensional measurement and angles"],
      ["2026-may-tz2-p2-q12", "Calculus", "Differentiation and tangents"],
      ["2026-may-tz3-p3-q2", "Geometry and trigonometry", "Circular-function graphs and models"],
      ["2026-may-tz3-p3-q2", "Geometry and trigonometry", "Trigonometric equations"],
    ] as const;
    for (const [id, topic, subtopic] of cases) {
      expect(filterQuestions(hl, { topics: [topic], subtopics: [subtopic] }).map((q) => q.id), `${id} ${subtopic}`).toContain(id);
    }
  });

  describe("item-level official tags (officialItems)", () => {
    const itemOrder = new Map(aaItems.items.map((entry, index) => [entry.item, index]));
    const groupById = new Map(aaTaxonomy.groups.map((group) => [group.id, group]));
    const data = { groupById, itemOrder };
    const records = aaOverlay.records as Array<(typeof aaOverlay.records)[number] & { officialItems?: string[] }>;
    const accepted = records.filter((record) => record.status === "accepted");

    it("only names items that exist and belong to one of the record's groups", () => {
      for (const record of records) {
        if (!record.officialItems) continue;
        expect(record.status, record.id).toBe("accepted");
        expect(record.officialItems.length, record.id).toBeGreaterThan(0);
        expect(new Set(record.officialItems).size, record.id).toBe(record.officialItems.length);
        const members = new Set(record.groupIds.flatMap((id) => groupById.get(id)?.memberOfficialItems ?? []));
        for (const item of record.officialItems) {
          expect(itemOrder.has(item), `${record.id} ${item}`).toBe(true);
          expect(members.has(item), `${record.id} ${item} not in its groups`).toBe(true);
        }
        const sorted = [...record.officialItems].sort((a, b) => itemOrder.get(a)! - itemOrder.get(b)!);
        expect(record.officialItems, record.id).toEqual(sorted);
      }
    });

    it("derives officialItems for every accepted record whose groups are all single-item", () => {
      const single = accepted.filter((record) => isSingleItemRecord(record, groupById));
      expect(single.length).toBeGreaterThan(0);
      for (const record of single) {
        expect(record.officialItems, record.id).toEqual(unionItems(record, data));
        expect(derivedItems(record, data), record.id).toEqual(record.officialItems);
      }
      // The two populations partition the accepted records.
      expect(single.length + accepted.filter((record) => !isSingleItemRecord(record, groupById)).length).toBe(accepted.length);
    });

    it("every accepted record has at least one officialItems entry", () => {
      for (const record of accepted) expect(record.officialItems?.length, record.id).toBeGreaterThan(0);
    });

    it("exposes identical officialItems from the loader and the bank-index generator", () => {
      for (const [bank, rawBank] of [["ib-sl", rawSl], ["ib-hl", rawHl]] as const) {
        const questions = (rawBank as { questions: Array<{ id: string }> }).questions;
        const loaded = new Map(normalizeBankQuestions(bank, questions as never[]).map((question) => [question.id, question]));
        let checked = 0;
        for (const rawQuestion of questions) {
          const row = loaded.get(rawQuestion.id)!;
          const index = metadataFromRaw(rawQuestion, { bank });
          expect(row.officialItems ?? [], rawQuestion.id).toEqual(index.officialItems ?? []);
          expect(toPublicQuestionMetadata(row).officialItems ?? [], rawQuestion.id).toEqual(index.officialItems ?? []);
          if (row.officialItems) checked += 1;
        }
        expect(checked, bank).toBeGreaterThan(0);
      }
    });

    it("writes the same officialItems into the generated public bank index", () => {
      for (const bank of ["ib-sl", "ib-hl"] as const) {
        const file = join(process.cwd(), "public", "bank-index", PUBLIC_BANK_INDEX_FILES[bank]);
        const index = JSON.parse(readFileSync(file, "utf8")) as PublicBankIndex;
        const loaded = new Map(normalizeBankQuestions(bank, (bank === "ib-sl" ? rawSl : rawHl).questions as never[]).map((question) => [question.id, question]));
        expect(index.questions.length).toBe(loaded.size);
        for (const metadata of index.questions) expect(metadata.officialItems ?? [], metadata.id).toEqual(loaded.get(metadata.id)!.officialItems ?? []);
      }
    });
  });
});
