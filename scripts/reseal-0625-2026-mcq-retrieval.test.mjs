import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reseal2026 } from "./reseal-0625-2026-mcq-retrieval.mjs";
import { assert0625PracticalRoleRepair, assert0625McqRetrievalRepair } from "../src/lib/igcse-runtime.ts";
import { normalizeBankQuestions } from "../src/lib/questions.ts";
import { filterQuestions } from "../src/lib/question-filter.ts";

const BASE = "0a0b2246e269c03f81669548947d011c4f68b741";
const readBase = (file) => JSON.parse(execFileSync("git", ["show", `${BASE}:${file}`], { maxBuffer: 50_000_000 }));
const baseline = readBase("src/data/production/igcse-physics-0625.json");
const frozen = JSON.parse(readFileSync("scripts/data/0625-2026-mcq-retrieval-targets.json", "utf8"));
const inputs = {
  baseline, frozen,
  manifestText: readFileSync("data/storage/igcse-physics-0625.manifest.json", "utf8"),
  receiptText: readFileSync("data/storage/igcse-physics-0625.receipt.json", "utf8"),
};

describe("0625 2026 MCQ retrieval reseal", () => {
  it("replays exactly fourteen metadata-only changes and preserves 144 prior practical repairs", () => {
    const result = reseal2026(inputs);
    expect(result).toEqual(JSON.parse(readFileSync("src/data/production/igcse-physics-0625.json", "utf8")));
    expect(result.questions).toHaveLength(5789);
    const changed = result.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(baseline.questions[i]));
    expect(changed.map((q) => q.id).sort()).toEqual(frozen.rows.map((row) => row[0]).sort());
    for (const q of changed) {
      const before = baseline.questions.find((row) => row.id === q.id);
      const keys = Object.keys(q).filter((key) => JSON.stringify(q[key]) !== JSON.stringify(before[key])).sort();
      expect(keys).toEqual(q.id === "0625-2026-m-12-q1"
        ? ["primaryTopic", "primaryTopicId"]
        : ["detailedSubtopics", "primaryTopic", "primaryTopicId", "subtopics"]);
      expect(q.classificationReviewStatus).toBe("unresolved_taxonomy_gap");
      expect(q.classificationProvenance).toEqual(before.classificationProvenance);
      expect(q.questionImages).toEqual(before.questionImages);
      expect(q.markschemeImages).toEqual(before.markschemeImages);
    }
    const broadOnly = changed.find((q) => q.id === "0625-2026-m-12-q1");
    expect(broadOnly.primaryTopic).toBe("Motion, forces and energy");
    expect(broadOnly.subtopics).toEqual([]);
    expect(broadOnly.detailedSubtopics).toEqual([]);
    expect(result.runtimeArtifact.practicalRoleRepair).toEqual(baseline.runtimeArtifact.practicalRoleRepair);
    expect(result.runtimeArtifact.assetManifestSha256).toEqual(baseline.runtimeArtifact.assetManifestSha256);
    expect(result.runtimeArtifact.storageReceiptSha256).toEqual(baseline.runtimeArtifact.storageReceiptSha256);
    expect(() => assert0625PracticalRoleRepair(result)).not.toThrow();
    expect(() => assert0625McqRetrievalRepair(result)).not.toThrow();
    const tampered = structuredClone(result);
    tampered.questions.find((q) => q.id === "0625-2026-m-12-q13").summary += " tampered";
    expect(() => assert0625McqRetrievalRepair(tampered)).toThrow(/finalized content mismatch/);
    expect(result).toEqual(reseal2026(inputs));
  }, 30000);

  it("changes exactly fourteen private-index rows and exposes every row through the intended student filters", () => {
    const original = readBase("src/data/private-index/igcse-physics-0625.json");
    const current = JSON.parse(readFileSync("src/data/private-index/igcse-physics-0625.json", "utf8"));
    expect(current.questions).toHaveLength(5789);
    const changed = current.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(original.questions[i]));
    expect(changed.map((q) => q.id).sort()).toEqual(frozen.rows.map(([id]) => id).sort());
    expect(changed.every((q) => Object.keys(q).every((key) => !["accessibleText", "summary", "questionImages", "markschemeImages", "classificationProvenance"].includes(key)))).toBe(true);
    for (const row of changed) {
      const old = original.questions.find((q) => q.id === row.id);
      expect(Object.keys(row).filter((key) => JSON.stringify(row[key]) !== JSON.stringify(old[key])).sort())
        .toEqual(row.id === "0625-2026-m-12-q1" ? ["primaryTopic"] : ["primaryTopic", "subtopics"]);
    }
    const questions = normalizeBankQuestions("igcse-physics-0625", current.questions);
    for (const [id, key] of frozen.rows) {
      const [topic, , detail] = frozen.labels[key];
      expect(filterQuestions(questions, { topics: [topic], subtopics: detail ? [detail] : [] }).some((q) => q.id === id)).toBe(true);
      if (detail === null) {
        expect(questions.find((q) => q.id === id).subtopics).toEqual([]);
        expect(filterQuestions(questions, { topics: [topic], subtopics: ["Physical quantities and measurement techniques"] }).some((q) => q.id === id)).toBe(false);
      }
    }
    expect(filterQuestions(questions, { topics: ["Thermal physics"], subtopics: ["Gases and temperature"] }).some((q) => q.id === "0625-2026-m-12-q3")).toBe(false);
  });

  it("rejects changed frozen targets, source evidence, baseline content, and receipt", () => {
    const changed = structuredClone(frozen);
    changed.rows[0][0] = "0625-2026-m-12-q2";
    expect(() => reseal2026({ ...inputs, frozen: changed })).toThrow(/cohort evidence changed/);
    const source = structuredClone(frozen);
    source.sourcePairs["0625-2026-s-11"][0] = "0".repeat(64);
    expect(() => reseal2026({ ...inputs, frozen: source })).toThrow(/cohort evidence changed/);
    const drift = structuredClone(baseline);
    drift.questions[0].summary += " altered";
    expect(() => reseal2026({ ...inputs, baseline: drift })).toThrow(/baseline runtime seal mismatch/);
    expect(() => reseal2026({ ...inputs, receiptText: inputs.receiptText + " " })).toThrow(/manifest or verified receipt changed/);
  });
});
