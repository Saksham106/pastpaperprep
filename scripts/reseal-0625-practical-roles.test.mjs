import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { deriveTargets, reseal } from "./reseal-0625-practical-roles.mjs";

const OLD_COMMIT = "b4dac6427191232ae9bd62ce9908b37d7318f92d";
const baselineFile = (name) => JSON.parse(execFileSync("git", ["show", `${OLD_COMMIT}:${name}`], { maxBuffer: 40_000_000 }));
const baseline = baselineFile("src/data/production/igcse-physics-0625.json");
const originalIndex = baselineFile("src/data/private-index/igcse-physics-0625.json");
const frozen = JSON.parse(readFileSync("scripts/data/0625-practical-retrieval-targets.json", "utf8"));
const manifestText = readFileSync("data/storage/igcse-physics-0625.manifest.json", "utf8");
const receiptText = readFileSync("data/storage/igcse-physics-0625.receipt.json", "utf8");
const input = { baseline, frozen, manifestText, receiptText };

test("exact 144 practical roles preserve unresolved provenance and all other records", () => {
  const result = reseal(input);
  const targets = new Set(deriveTargets(baseline, frozen));
  expect(result).toEqual(JSON.parse(readFileSync("src/data/production/igcse-physics-0625.json", "utf8")));
  for (let i = 0; i < baseline.questions.length; i++) {
    const before = baseline.questions[i];
    const after = result.questions[i];
    if (!targets.has(before.id)) {
      expect(after).toEqual(before);
      continue;
    }
    const stripped = structuredClone(after);
    stripped.primaryTopic = before.primaryTopic;
    stripped.primaryTopicId = before.primaryTopicId;
    stripped.subtopics = before.subtopics;
    stripped.detailedSubtopics = before.detailedSubtopics;
    expect(stripped).toEqual(before);
    expect(after.subtopics).toEqual(["Experimental skills and investigations"]);
    expect(after.classificationReviewStatus).toBe("unresolved_taxonomy_gap");
  }
  const publishedIndex = JSON.parse(readFileSync("src/data/private-index/igcse-physics-0625.json", "utf8"));
  const indexTargets = new Set(publishedIndex.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(originalIndex.questions[i])).map((q) => q.id));
  expect(indexTargets).toEqual(targets);
});

test("source, receipt, manifest, and target substitutions fail closed", () => {
  const swapped = structuredClone(frozen);
  swapped.ids[0] = "0625-2023-s-11-q1";
  expect(() => reseal({ ...input, frozen: swapped })).toThrow(/target/);
  const sourceDrift = structuredClone(baseline);
  sourceDrift.questions[0].summary += " altered";
  expect(() => reseal({ ...input, baseline: sourceDrift })).toThrow(/baseline runtime hash/);
  expect(() => reseal({ ...input, receiptText: receiptText.replace("verified_readback", "pending_upload") })).toThrow(/receipt bytes/);
  expect(() => reseal({ ...input, manifestText: manifestText.replace("pending_upload", "verified_readback") })).toThrow(/manifest canonical hash/);
});
