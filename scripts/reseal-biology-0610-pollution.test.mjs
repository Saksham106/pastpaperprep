import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reseal } from "./reseal-biology-0610-pollution.mjs";
import { assert0610PollutionRepair } from "../src/lib/igcse-runtime.ts";
import { normalizeBankQuestions } from "../src/lib/questions.ts";
import { filterQuestions } from "../src/lib/question-filter.ts";

const BASE = "10ed3bfbb290d07b3d7a46d5010b464f58030b25";
const ID = "0610-2022-w-43-q5";
const Q42 = "0610-2022-w-42-q4";
const fromGit = (name) => JSON.parse(execFileSync("git", ["show", `${BASE}:${name}`], { maxBuffer: 50_000_000 }));
const baseline = fromGit("src/data/production/igcse-biology-0610.json");
const oldIndex = fromGit("src/data/private-index/igcse-biology-0610.json");
const manifestText = readFileSync("data/storage/igcse-biology-0610.manifest.json", "utf8");
const receiptText = readFileSync("data/storage/igcse-biology-0610.receipt.json", "utf8");
const inputs = { baseline, manifestText, receiptText };

describe("0610 one-row, source-bound Pollution reseal", () => {
  it("replays byte-identically and changes only four classification fields of Q43", () => {
    const a = reseal(inputs);
    expect(a).toEqual(reseal(inputs));
    expect(a).toEqual(JSON.parse(readFileSync("src/data/production/igcse-biology-0610.json", "utf8")));
    expect(a.questions).toHaveLength(4913);
    const changed = a.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(baseline.questions[i]));
    expect(changed.map((q) => q.id)).toEqual([ID]);
    const before = baseline.questions.find((q) => q.id === ID);
    const after = changed[0];
    expect(Object.keys(after).filter((key) => JSON.stringify(after[key]) !== JSON.stringify(before[key])).sort())
      .toEqual(["detailedSubtopics", "primaryTopic", "primaryTopicId", "subtopics"]);
    expect(after.classificationProvenance).toEqual(before.classificationProvenance);
    expect(after.questionImages).toEqual(before.questionImages);
    expect(after.markschemeImages).toEqual(before.markschemeImages);
    expect(a.questions.find((q) => q.id === Q42)).toEqual(baseline.questions.find((q) => q.id === Q42));
    expect(a.questions.find((q) => q.id === Q42)).toBeDefined();
    expect(a.runtimeArtifact.assetManifestSha256).toBe(baseline.runtimeArtifact.assetManifestSha256);
    expect(a.runtimeArtifact.storageReceiptSha256).toBe(baseline.runtimeArtifact.storageReceiptSha256);
    expect(() => assert0610PollutionRepair(a)).not.toThrow();
    const tampered = structuredClone(a);
    tampered.questions.find((q) => q.id === ID).summary += " altered";
    expect(() => assert0610PollutionRepair(tampered)).toThrow(/finalized content mismatch/);
  }, 30000);

  it("preserves all other private-index rows and reaches the real Pollution filter", () => {
    const index = JSON.parse(readFileSync("src/data/private-index/igcse-biology-0610.json", "utf8"));
    expect(index.questions).toHaveLength(4913);
    const changed = index.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(oldIndex.questions[i]));
    expect(changed.map((q) => q.id)).toEqual([ID]);
    expect(changed[0].primaryTopic).toBe("Human influences on ecosystems");
    expect(changed[0].subtopics).toEqual(["Pollution"]);
    const questions = normalizeBankQuestions("igcse-biology-0610", index.questions);
    expect(filterQuestions(questions, { topics: ["Human influences on ecosystems"], subtopics: ["Pollution"] }).some((q) => q.id === ID)).toBe(true);
    expect(filterQuestions(questions, { topics: ["Biotechnology and genetic engineering"] }).some((q) => q.id === ID)).toBe(false);
  });

  it("fails closed for source, manifest, receipt, and target drift", () => {
    const sourceDrift = structuredClone(baseline);
    sourceDrift.questions.find((q) => q.id === ID).summary += " drift";
    expect(() => reseal({ ...inputs, baseline: sourceDrift })).toThrow(/baseline seal mismatch/);
    expect(() => reseal({ ...inputs, manifestText: manifestText + " " })).toThrow(/manifest\/receipt bytes changed/);
    expect(() => reseal({ ...inputs, receiptText: receiptText + " " })).toThrow(/manifest\/receipt bytes changed/);
    const targetDrift = structuredClone(baseline);
    targetDrift.questions.find((q) => q.id === ID).id = "0610-2022-w-43-q6";
    expect(() => reseal({ ...inputs, baseline: targetDrift })).toThrow(/baseline seal mismatch/);
  });
});
