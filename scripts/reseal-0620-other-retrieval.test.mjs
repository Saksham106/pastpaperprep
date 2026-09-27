import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { reseal0620Other } from "./reseal-0620-other-retrieval.mjs";

const load = (p) => JSON.parse(readFileSync(path.join(process.cwd(), p), "utf8"));

// Exact frozen source-reviewed cohort, not a general-purpose classifier.
test("replay routes only the original 30 Chemistry Other rows and preserves all content and assets", () => {
  const baseline = JSON.parse(execFileSync("git", ["show", "197ac22550d5bcb7559eafdbc0ae5cf391924bd5:src/data/production/igcse-chemistry-0620.json"], { cwd: process.cwd(), maxBuffer: 50_000_000 }).toString("utf8"));
  const frozen = load("scripts/data/0620-other-retrieval-targets.json");
  const taxonomy = load("src/data/igcse-chemistry-0620-taxonomy.json");
  const candidate = reseal0620Other({ baseline, frozen, taxonomy });
  const targeted = new Set(frozen.rows.map((r) => r.id));
  expect(targeted.size).toBe(30);
  expect(candidate.questions.length).toBe(5129);
  for (let i = 0; i < baseline.questions.length; i++) {
    const before = baseline.questions[i], after = candidate.questions[i];
    if (!targeted.has(before.id)) { expect(after).toEqual(before); continue; }
    for (const field of ["id", "questionImages", "markschemeImages", "accessibleText", "summary", "marks", "classificationProvenance", "officialMarkscheme"])
      expect(after[field], `${before.id}:${field}`).toEqual(before[field]);
    expect(after.classificationReviewStatus).toBe("unresolved_taxonomy_gap");
    expect(after.primaryTopic).not.toBe("Other");
    expect(after.subtopics.length).toBeGreaterThan(0);
  }
  expect(candidate.questions.find((q) => q.id === "0620-2020-s-13-q40")?.subtopics).toContain("Polymers");
  expect(candidate.questions.find((q) => q.id === "0620-2026-m-12-q2")?.subtopics).toEqual(["Solids, liquids and gases", "Diffusion"]);
  expect(candidate.questions.find((q) => q.id === "0620-2026-s-32-q5")?.subtopics).toContain("Diffusion");
  expect(candidate.questions.find((q) => q.id === "0620-2021-m-32-q7")?.primaryTopic).toBe("Electrochemistry");
  expect(candidate.questions.find((q) => q.id === "0620-2021-m-42-q4")?.secondaryTopics).toContain("Stoichiometry");
});
