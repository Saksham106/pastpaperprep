#!/usr/bin/env node
/**
 * IGCSE science written-paper marks reseal (Chemistry 0620, Coordinated Sciences 0654):
 * question totals from the printed papers. Assets and classifications are untouched.
 * The repair records every change, so the runtime loader can rebuild the exact sealed baseline and keep
 * every earlier repair seal unchanged (see withoutPrintedMarks in src/lib/igcse-runtime.ts).
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeSha256, sha256 } from "./igcse-release.mjs";

export const BASE = "8e6cea7a6f5c93899f9396a6cf7a670682837983";
// Biology 0610 is in the census as evidence only: one of its three differences is already served through the
// reviewed historical-crop overlay, and the other two belong in that sealed overlay rather than the runtime.
export const BANKS = ["igcse-chemistry-0620", "igcse-coordinated-sciences-0654"];
const MAX = { "igcse-coordinated-sciences-0654": { 3: 120, 4: 120, 5: 60, 6: 60 } };
const paperMax = (bank, paper) => (MAX[bank] ?? { 3: 80, 4: 80, 5: 40, 6: 40 })[paper.split("-").at(-1)[0]];
const assert = (condition, reason) => { if (!condition) throw new Error(`IGCSE printed marks reseal: ${reason}`); };
const written = (q) => /^[3-6]/.test(String(q.component));
const paperOf = (id) => id.replace(/-q\d+$/, "");

/** Accepted papers reconcile exactly; unresolved and excluded rows stay as they are. */
export function bankChanges(bank, baseline, census) {
  assert(census.schemaVersion === "igcse-science-printed-marks-census-v1", "census schema changed");
  const entry = census.banks[bank];
  assert(entry, `${bank} missing from census`);
  const stored = new Map(baseline.questions.map((q) => [q.id, q]));
  const papers = new Map();
  for (const q of baseline.questions.filter(written)) papers.set(paperOf(q.id), (papers.get(paperOf(q.id)) ?? 0) + 1);
  const covered = new Set([...Object.keys(entry.papers), ...entry.unresolvedPapers]);
  assert(covered.size === papers.size && [...papers.keys()].every((p) => covered.has(p)), `${bank}: census does not account for every written paper`);
  const excluded = new Set(entry.excludedQuestionIds);
  const changes = [];
  for (const [paper, { paperMax: max, qpSha256, questions }] of Object.entries(entry.papers)) {
    assert(max === paperMax(bank, paper) && /^[a-f0-9]{64}$/.test(qpSha256), `${paper}: maximum or source hash invalid`);
    assert(questions.length === papers.get(paper), `${paper}: question count differs from the runtime`);
    assert(questions.reduce((sum, row) => sum + row[2], 0) === max, `${paper}: printed totals do not sum to ${max}`);
    questions.forEach(([number, before, printed, from], i) => {
      const id = `${paper}-q${number}`;
      assert(number === i + 1 && Number.isInteger(printed) && printed > 0 && ["total", "single-part-mark"].includes(from), `${id}: bad census row`);
      assert(stored.get(id)?.marks === before, `${id}: stored marks drifted from the census`);
      if (before !== printed && !excluded.has(id)) changes.push([id, before, printed]);
    });
  }
  return changes;
}

export function resealBank(bank, { baseline, census }) {
  const seal = baseline.runtimeArtifact;
  assert(runtimeSha256(baseline) === seal?.runtimeSha256, `${bank}: baseline runtime seal mismatch`);
  assert(baseline.releaseStatus === "production" && baseline.assetVerification === "verified_readback", `${bank}: baseline not finalized`);
  assert(!seal.printedMarksRepair, `${bank}: already resealed`);
  const changes = bankChanges(bank, baseline, census);
  assert(changes.length > 0, `${bank}: nothing to change`);
  const byId = new Map(changes.map(([id, , printed]) => [id, printed]));
  const output = structuredClone(baseline);
  for (const q of output.questions) {
    if (!byId.has(q.id)) continue;
    q.marks = byId.get(q.id);
    q.maxMarks = byId.get(q.id);
  }
  output.runtimeArtifact.printedMarksRepair = {
    baselineGitCommit: BASE,
    baselineRuntimeSha256: seal.runtimeSha256,
    baselineFinalizedContentSha256: seal.finalizedContentSha256 ?? null,
    censusSha256: sha256(JSON.stringify(census.banks[bank])),
    changedCount: changes.length,
    changes,
    method: "printed question totals from the question-paper text layer; only papers that reconcile to their printed maximum; MCQ papers unchanged",
  };
  output.runtimeArtifact.finalizedContentSha256 = sha256(JSON.stringify(output.questions));
  output.runtimeArtifact.runtimeSha256 = null;
  output.runtimeArtifact.runtimeSha256 = runtimeSha256(output);
  return output;
}

async function main() {
  const mode = process.argv[2];
  assert(mode === "--write" || mode === "--check", "choose --check for read-only replay or --write");
  const root = path.resolve(import.meta.dirname, "..");
  const fromBase = (file) => execFileSync("git", ["show", `${BASE}:${file}`], { cwd: root, maxBuffer: 80_000_000 }).toString("utf8");
  const census = JSON.parse(await readFile(path.join(root, "scripts/data/igcse-science-printed-marks-census.json"), "utf8"));
  for (const bank of BANKS) {
    const output = resealBank(bank, { baseline: JSON.parse(fromBase(`src/data/production/${bank}.json`)), census });
    const index = JSON.parse(fromBase(`src/data/private-index/${bank}.json`));
    const marks = new Map(output.questions.map((q) => [q.id, q.marks]));
    for (const q of index.questions) if (marks.has(q.id) && q.marks !== undefined) q.marks = marks.get(q.id);
    const files = [[`src/data/production/${bank}.json`, `${JSON.stringify(output)}\n`], [`src/data/private-index/${bank}.json`, `${JSON.stringify(index)}\n`]];
    for (const [file, text] of files) {
      if (mode === "--check") assert(await readFile(path.join(root, file), "utf8") === text, `${file} replay differs`);
      else await writeFile(path.join(root, file), text);
    }
    console.log(JSON.stringify({ mode, bank, changed: output.runtimeArtifact.printedMarksRepair.changedCount, runtimeSha256: output.runtimeArtifact.runtimeSha256, contentSha256: output.runtimeArtifact.finalizedContentSha256 }));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
