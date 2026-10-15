#!/usr/bin/env node
// Adds the official IB Physics May 2026 papers (HL 153 / SL 99 questions) to the raw banks.
//
//   node scripts/add-ib-physics-2026.mjs [--check]
//
// Inputs (pinned by SHA-256): the source lane's app additions and adjudicated final labels, from
// branch feat/may-2026-official of ib-physics-topic-practice (override the checkout with
// PASTPAPERPREP_IB_PHYSICS_SOURCE_ROOT). The baseline is read from the pinned app commit with
// `git show`, never from the working tree, so a rebuild is byte-identical and every earlier row,
// paper and header field is provably unchanged: the 2026 rows are appended after the last 2025
// November row. src/data/production/ib-physics-*.json mirrors the raw files byte for byte, as before.
// Also writes the reviewed-label manifest docs/audits/ib-physics-may-2026-review.json.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const BASE_COMMIT = "5d0f243624e449a7b589d83708145102e3b5bfb3";
const SOURCE_COMMIT_PREFIX = "7d1b6e7";
const PINS = {
  HL: { additions: "7830555bf2506ca08a3b65b6c6ac4b125539ee215eb5312ad7099065cc37e6f0", questions: 153, papers: 9 },
  SL: { additions: "0ec478fc34da97c4950013e5e75d4fc77790da9fbee24aef9e46aadd1208349d", questions: 99, papers: 9 },
};
const FINAL_LABELS_SHA256 = "55b07dcb9c605ebe7e3cada9b9ebc8a1a6c088f405d379b859e5579cd2dbf88b";
const ADJUDICATION_SHA256 = "bd279b582757bc765664cced35691f8d74f28ba7d27384fbe6aabfa99fcc259b";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

function workspaceRoot() {
  const common = execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
  return resolve(dirname(common), "..");
}
const sourceRoot = process.env.PASTPAPERPREP_IB_PHYSICS_SOURCE_ROOT
  ? resolve(process.env.PASTPAPERPREP_IB_PHYSICS_SOURCE_ROOT)
  : join(workspaceRoot(), "ib-physics-topic-practice/.worktrees/may-2026");
const sourceCommit = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
// The inputs are pinned by SHA-256 below; the checkout only needs to descend from the lane commit.
try {
  execFileSync("git", ["-C", sourceRoot, "merge-base", "--is-ancestor", SOURCE_COMMIT_PREFIX, sourceCommit], { stdio: "ignore" });
} catch {
  throw new Error(`Source checkout at ${sourceCommit} does not descend from ${SOURCE_COMMIT_PREFIX}`);
}
const gitShow = (path) => execFileSync("git", ["-C", root, "show", `${BASE_COMMIT}:${path}`], { maxBuffer: 400_000_000 });
const finalBytes = readFileSync(join(sourceRoot, "data/may-2026/classification/final-classifications.json"));
if (sha(finalBytes) !== FINAL_LABELS_SHA256) throw new Error("final-classifications.json hash drift");
const adjudicationBytes = readFileSync(join(sourceRoot, "data/may-2026/classification/adjudication.json"));
if (sha(adjudicationBytes) !== ADJUDICATION_SHA256) throw new Error("adjudication.json hash drift");
const finalRows = new Map(JSON.parse(finalBytes).classifications.map((row) => [row.id, row]));
const adjudication = JSON.parse(adjudicationBytes).decisions;

const reviewRows = [];
const outputs = new Map();
for (const level of ["HL", "SL"]) {
  const lower = level.toLowerCase();
  const rawPath = `src/data/raw/ib-physics-${lower}.json`;
  const baseText = gitShow(rawPath).toString("utf8");
  const base = JSON.parse(baseText);
  if (`${JSON.stringify(base)}\n` !== baseText) throw new Error(`Baseline ${rawPath} is not canonical JSON`);
  const additionsBytes = readFileSync(join(sourceRoot, `site/data/app-additions/ib-physics-${lower}-2026.json`));
  if (sha(additionsBytes) !== PINS[level].additions) throw new Error(`${level} additions hash drift`);
  const additions = JSON.parse(additionsBytes);
  if (additions.finalManifestSha256 !== FINAL_LABELS_SHA256) throw new Error(`${level} additions were built from other labels`);
  if (additions.questions.length !== PINS[level].questions || additions.papers.length !== PINS[level].papers) throw new Error(`${level} addition counts drift`);
  const existing = new Set(base.questions.map((q) => q.id));
  const existingPapers = new Set(base.papers.map((p) => p.id));
  for (const q of additions.questions) {
    if (existing.has(q.id)) throw new Error(`Duplicate question id ${q.id}`);
    if (q.year !== 2026 || q.course !== base.course) throw new Error(`Unexpected addition ${q.id}`);
    const row = finalRows.get(q.id);
    if (!row) throw new Error(`No final labels for ${q.id}`);
    const decision = adjudication[q.id];
    reviewRows.push({
      id: q.id, level, primarySubtopic: row.primary_subtopic_id, officialTopicCodes: row.official_topic_codes,
      secondarySubtopics: row.secondary_subtopic_ids, confidence: row.confidence, provenance: row.provenance,
      adjudication: decision ? { chose: decision.chose, rationale: decision.rationale } : null,
    });
  }
  for (const p of additions.papers) if (existingPapers.has(p.id)) throw new Error(`Duplicate paper id ${p.id}`);
  const next = {
    ...base,
    papers: [...base.papers, ...additions.papers],
    questions: [...base.questions, ...additions.questions],
    years: [...base.years, 2026],
    may2026Release: {
      schemaVersion: "ib-physics-may-2026-release.v1",
      source: "Official IB May 2026 papers and markschemes (papers.xtremepape.rs mirror of the IB release)",
      sourceBranch: "feat/may-2026-official",
      sourceCommitPrefix: SOURCE_COMMIT_PREFIX,
      additionsSha256: PINS[level].additions,
      finalLabelsSha256: FINAL_LABELS_SHA256,
      baseCommit: BASE_COMMIT,
      baseQuestionCount: base.questions.length,
      addedQuestionCount: additions.questions.length,
      combinedQuestionCount: base.questions.length + additions.questions.length,
      addedPaperCount: additions.papers.length,
    },
  };
  const text = `${JSON.stringify(next)}\n`;
  // Every baseline row, paper and header field must survive byte for byte.
  for (const key of Object.keys(base)) {
    if (key === "papers" || key === "questions" || key === "years") continue;
    if (JSON.stringify(next[key]) !== JSON.stringify(base[key])) throw new Error(`Header field changed: ${key}`);
  }
  base.questions.forEach((q, i) => { if (JSON.stringify(next.questions[i]) !== JSON.stringify(q)) throw new Error(`Row changed: ${q.id}`); });
  base.papers.forEach((p, i) => { if (JSON.stringify(next.papers[i]) !== JSON.stringify(p)) throw new Error(`Paper changed: ${p.id}`); });
  outputs.set(`src/data/raw/ib-physics-${lower}.json`, text);
  outputs.set(`src/data/production/ib-physics-${lower}.json`, text);
}

const manifest = {
  manifestVersion: "ib-physics-may-2026-review.1",
  reviewedQuestionCount: reviewRows.length,
  reviewMethod: "Official May 2026 TZ1-TZ3 questions: a source-grounded primary pass from the question crop and official markscheme, a separate blind second pass from sealed evidence without the primary labels or the Drex triage scores, and a written adjudication of every row where the passes differ (primary subtopic, primary code, code set or secondaries). Drex (drex-v2.0, text only) was used for triage only.",
  sourceCommitPrefix: SOURCE_COMMIT_PREFIX,
  finalLabelsSha256: FINAL_LABELS_SHA256,
  adjudicationSha256: ADJUDICATION_SHA256,
  rows: reviewRows.sort((a, b) => a.id.localeCompare(b.id)),
};
outputs.set("docs/audits/ib-physics-may-2026-review.json", `${JSON.stringify(manifest, null, 2)}\n`);

let drift = 0;
for (const [path, text] of outputs) {
  const target = join(root, path);
  if (check) {
    let current = "";
    try { current = readFileSync(target, "utf8"); } catch { /* missing */ }
    if (current !== text) { drift++; console.error(`DRIFT ${path}`); }
  } else writeFileSync(target, text);
}
if (check && drift) process.exit(1);
console.log(`${check ? "checked" : "wrote"} ${outputs.size} files; ${reviewRows.length} reviewed rows; raw ${[...outputs].filter(([p]) => p.startsWith("src/data/raw")).map(([p, t]) => `${p.split("/").pop()}=${sha(t).slice(0, 12)}`).join(" ")}`);
