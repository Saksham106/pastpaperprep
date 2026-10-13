import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BASELINE, CHANGED_FIELDS, FROZEN_PATH, freeze, readBaseline, readBaselineIndex, readBaselineStorage, reseal, resealPrivateIndex,
} from "./reseal-biology-0610-secondaries.mjs";
import { EXTENSION_ASSEMBLY, TAXONOMY_V2_PATH, defaultSourceRoot, loadExtensionAssembly } from "./generate-igcse-biology-0610-extension-candidate.mjs";
import { assert0610PollutionRepair, assert0610SecondaryTopicsRepair } from "../src/lib/igcse-runtime.ts";
import { normalizeBankQuestions } from "../src/lib/questions.ts";
import { filterQuestions } from "../src/lib/question-filter.ts";

const BANK = "igcse-biology-0610";
const baseline = readBaseline();
const baselineIndex = readBaselineIndex();
const frozen = JSON.parse(readFileSync(FROZEN_PATH, "utf8"));
// The verified pair of the 4,913-row release on main; the committed files now describe the 2026 release.
const { manifestText, receiptText } = readBaselineStorage();
const inputs = { baseline, frozen, manifestText, receiptText };
const current = JSON.parse(readFileSync(`src/data/production/${BANK}.json`, "utf8"));
const currentIndex = JSON.parse(readFileSync(`src/data/private-index/${BANK}.json`, "utf8"));
const targets = new Set(frozen.rows.map((row) => row.id));
/** The resealed 4,913-row release is the committed runtime (or, once 2026 May/June is appended, its prefix). */
const published = (runtime) => runtime.questions.slice(0, 4913);

describe("0610 extension material secondaries (metadata-only reseal of finalized rows)", () => {
  it("replays exactly 200 rows, changing only the secondary and subtopic fields", () => {
    const result = reseal(inputs);
    expect(result).toEqual(reseal(inputs));
    expect(result.questions).toEqual(published(current));
    expect(result.questions).toHaveLength(4913);
    const changed = result.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(baseline.questions[i]));
    expect(changed.map((q) => q.id).sort()).toEqual([...targets].sort());
    expect(changed.filter((q) => q.year === 2019)).toHaveLength(105);
    expect(changed.filter((q) => q.year === 2020)).toHaveLength(83);
    expect(changed.filter((q) => q.year === 2026)).toHaveLength(12);
    for (const q of changed) {
      const before = baseline.questions.find((row) => row.id === q.id);
      const keys = [...new Set([...Object.keys(q), ...Object.keys(before)])].filter((key) => JSON.stringify(q[key]) !== JSON.stringify(before[key]));
      expect(keys.every((key) => CHANGED_FIELDS.includes(key))).toBe(true);
      expect(q.primaryTopic).toBe(before.primaryTopic);
      expect(q.primaryTopicId).toBe(before.primaryTopicId);
      expect(q.subtopics[0]).toBe(before.subtopics[0]);
      expect(q.detailedSubtopics).toEqual(q.subtopics);
      expect(q.secondaryTopicIds).not.toContain(q.primaryTopicId);
      expect(new Set(q.secondaryTopicIds).size).toBe(q.secondaryTopicIds.length);
      expect(q.questionImages).toEqual(before.questionImages);
      expect(q.markschemeImages).toEqual(before.markschemeImages);
      expect(q.classificationProvenance).toEqual(before.classificationProvenance);
      expect([q.publicationStatus, q.classificationReviewStatus]).toEqual(["production", "classified"]);
    }
    const ra = result.runtimeArtifact;
    expect(ra.assetManifestSha256).toBe(BASELINE.assetManifestSha256);
    expect(ra.storageReceiptSha256).toBe(BASELINE.storageReceiptSha256);
    expect(ra.originalCandidateRuntimeSha256).toBe(baseline.runtimeArtifact.originalCandidateRuntimeSha256);
    expect(ra.taxonomyRepair).toEqual(baseline.runtimeArtifact.taxonomyRepair);
    expect(ra.secondaryTopicsRepair).toMatchObject({ changedCount: 200, secondaryLabelCount: 338, baselineFinalizedContentSha256: BASELINE.finalizedContentSha256 });
    expect(() => assert0610PollutionRepair(result)).not.toThrow();
    expect(() => assert0610SecondaryTopicsRepair(result)).not.toThrow();
    const tampered = structuredClone(result);
    tampered.questions.find((q) => q.id === "0610-2019-m-32-q10").secondaryTopics.push("Drugs");
    expect(() => assert0610SecondaryTopicsRepair(tampered)).toThrow(/material-secondaries repair/);
    const other = structuredClone(result);
    other.questions.find((q) => q.id === "0610-2019-m-12-q1").secondaryTopics = ["Respiration"];
    expect(() => assert0610SecondaryTopicsRepair(other)).toThrow(/finalized content mismatch/);
  }, 60000);

  it("fails closed on baseline, storage, cohort or target drift", () => {
    const drift = structuredClone(baseline);
    drift.questions[0].summary += " drift";
    expect(() => reseal({ ...inputs, baseline: drift })).toThrow(/baseline seal mismatch/);
    expect(() => reseal({ ...inputs, manifestText: manifestText + " " })).toThrow(/manifest\/receipt bytes changed/);
    expect(() => reseal({ ...inputs, receiptText: receiptText + " " })).toThrow(/manifest\/receipt bytes changed/);
    const cohort = structuredClone(frozen);
    cohort.rows[0].secondaryTopics = ["Respiration"];
    expect(() => reseal({ ...inputs, frozen: cohort })).toThrow(/frozen cohort changed/);
  });

  it("changes only secondaryTopics and subtopics of the same 200 private-index rows", () => {
    const index = resealPrivateIndex(baselineIndex, frozen);
    expect(index.questions).toEqual(currentIndex.questions.slice(0, 4913));
    const changed = index.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(baselineIndex.questions[i]));
    expect(changed.map((q) => q.id).sort()).toEqual([...targets].sort());
    for (const row of changed) {
      const old = baselineIndex.questions.find((q) => q.id === row.id);
      expect(Object.keys(row).filter((key) => JSON.stringify(row[key]) !== JSON.stringify(old[key])).every((key) => ["secondaryTopics", "subtopics"].includes(key))).toBe(true);
    }
  });

  it("makes a 2019 extension row filterable by its secondary topic, as 2021-2025 rows already are", () => {
    const after = normalizeBankQuestions(BANK, published(current));
    const before = normalizeBankQuestions(BANK, baseline.questions);
    const id = "0610-2019-m-32-q10"; // primary 15.1 Drugs; material secondary 11.1 gas exchange (+ 15.2, 15.3)
    const q = after.find((row) => row.id === id);
    expect(q.primaryTopic).toBe("Drugs");
    expect(q.secondaryTopics).toContain("Gas exchange in humans");
    expect(q.officialCodeRefs).toEqual(["2020_2021:15.1", "2020_2021:11.1", "2020_2021:15.2", "2020_2021:15.3"]);
    expect(filterQuestions(after, { topics: ["Gas exchange in humans"] }).some((row) => row.id === id)).toBe(true);
    expect(filterQuestions(before, { topics: ["Gas exchange in humans"] }).some((row) => row.id === id)).toBe(false);
    // A 2021-2025 row with reviewed secondaries behaves the same way.
    const base = after.find((row) => row.id === "0610-2023-w-22-q34");
    expect(base.secondaryTopics).toEqual(["Inheritance", "Reproduction"]);
    expect(filterQuestions(after, { topics: ["Inheritance"] }).some((row) => row.id === base.id)).toBe(true);
  }, 60000);

  const sourceRoot = defaultSourceRoot();
  it.skipIf(!existsSync(path.join(sourceRoot, EXTENSION_ASSEMBLY)))("re-derives the frozen cohort from the pinned source assembly", async () => {
    const { assembly } = await loadExtensionAssembly(sourceRoot);
    const taxonomyText = readFileSync(TAXONOMY_V2_PATH, "utf8");
    expect(freeze({ assembly, taxonomy: JSON.parse(taxonomyText), taxonomyText, baseline })).toEqual(frozen);
    expect(assembly.questions.filter((row) => row.classification.final.material_secondaries.length)).toHaveLength(200);
  }, 60000);
});
