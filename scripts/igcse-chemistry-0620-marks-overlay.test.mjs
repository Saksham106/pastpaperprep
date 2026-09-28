import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const BASE = "5e6abbe33cb1a0d23f5148f39824390ed58312dd";
const pinned = (filename) => JSON.parse(execFileSync("git", ["show", `${BASE}:${filename}`], {cwd:root,maxBuffer:100_000_000}).toString("utf8"));
const digest = (value) => createHash("sha256").update(value).digest("hex");
const json = async (filename) => JSON.parse(await readFile(path.join(root, filename), "utf8"));
const overlay = await json("data/classification/marks-repair/igcse-chemistry-0620-overlay-v1.json");

function validate(bundle, production, privateIndex) {
  if (bundle.schemaVersion !== "igcse-chemistry-0620-marks-overlay-v1" || bundle.apply !== false) throw new Error("overlay must remain versioned and unapplied");
  if (digest(JSON.stringify(production)) !== bundle.baseline.productionSha256) throw new Error("stale production baseline");
  if (digest(JSON.stringify(privateIndex)) !== bundle.baseline.privateIndexSha256) throw new Error("stale private index baseline");
  const ids = bundle.targets.map((row) => row.question_id);
  if (ids.length !== 90 || new Set(ids).size !== ids.length) throw new Error("target ID set must contain 90 unique IDs");
  if (digest(JSON.stringify([...ids].sort())) !== bundle.targetIdsSha256) throw new Error("target ID seal mismatch");
  const missing = bundle.targets.filter((row) => row.issue === "missing");
  const mismatched = bundle.targets.filter((row) => row.issue !== "missing");
  if (missing.length !== 74 || mismatched.length !== 16) throw new Error("missing/non-null mismatch partition changed");
  const papers = new Map(bundle.papers.map((paper) => [paper.paper_id, paper]));
  if (papers.size !== 23 || [...papers.values()].some((paper) => paper.expected_total !== paper.source_total || ![40, 80].includes(paper.expected_total))) throw new Error("23-paper printed-maximum reconciliation failed");
  for (const row of bundle.targets) {
    const q = production.questions.find((item) => item.id === row.question_id);
    if (!q || q.marks !== row.stored_marks) throw new Error(`target baseline mismatch: ${row.question_id}`);
    if (!Number.isInteger(row.proposed_marks) || row.proposed_marks < 1 || !papers.has(row.paper_id)) throw new Error(`invalid target evidence: ${row.question_id}`);
    if (row.status !== "qp_source_candidate_ms_unreconciled") throw new Error(`source review incomplete: ${row.question_id}`);
    const indexed = privateIndex.questions.find((item) => item.id === row.question_id);
    if (!indexed || indexed.marks !== q.marks) throw new Error(`private index marks mismatch: ${row.question_id}`);
  }
  return true;
}

describe("Chemistry 0620 unapplied marks overlay", () => {
  it("pins exact target cohort, source totals and unchanged live baseline", async () => {
    const production = pinned("src/data/production/igcse-chemistry-0620.json");
    const privateIndex = pinned("src/data/private-index/igcse-chemistry-0620.json");
    expect(validate(overlay, production, privateIndex)).toBe(true);
  });
  it("rejects stale live runtime or private-index baseline", async () => {
    const production = pinned("src/data/production/igcse-chemistry-0620.json");
    const privateIndex = pinned("src/data/private-index/igcse-chemistry-0620.json");
    expect(() => validate(overlay, { ...production, questionCount: -1 }, privateIndex)).toThrow(/stale production/);
    expect(() => validate(overlay, production, { ...privateIndex, questionCount: -1 })).toThrow(/stale private index/);
  });
  it("rejects target-set or row corruption", async () => {
    const production = pinned("src/data/production/igcse-chemistry-0620.json");
    const privateIndex = pinned("src/data/private-index/igcse-chemistry-0620.json");
    const corrupted = structuredClone(overlay); corrupted.targets.pop();
    expect(() => validate(corrupted, production, privateIndex)).toThrow(/90 unique IDs/);
  });
});
