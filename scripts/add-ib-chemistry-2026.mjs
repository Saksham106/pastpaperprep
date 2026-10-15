#!/usr/bin/env node
// Adds the official IB Chemistry May 2026 papers (HL 144 / SL 109 questions) to the raw banks.
//
//   node scripts/add-ib-chemistry-2026.mjs [--check]
//
// Inputs (pinned by SHA-256): the source lane's app additions and adjudicated final labels, from
// branch feat/may-2026-official of ib-chemistry-topic-practice (override the checkout with
// PASTPAPERPREP_IB_CHEMISTRY_SOURCE_ROOT). The baseline is read from the pinned app commit with
// `git show`, never from the working tree, so a rebuild is byte-identical and every earlier row,
// paper and header field is provably unchanged: the 2026 rows are appended after the last 2025
// November row. src/data/production/ib-chemistry-*.json mirrors the raw files byte for byte, as before.
// Also writes the reviewed-label manifest docs/audits/ib-chemistry-may-2026-review.json (primary,
// secondaries and official codes of every added row, with the adjudication reason where the passes differed).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const BASE_COMMIT = "18d8b98df165fad17c4f632e8a156214c27227fa";
const SOURCE_COMMIT_PREFIX = "f6aad08";
const PINS = {
  HL: { additions: "2b07a6d57fad45d5617e4e0b6d3c3d7474c74d24b31d5d7bef573be18fbc4f02", questions: 144, papers: 9 },
  SL: { additions: "0cfb61230f156ec500d24908f6ed6dc39947e99102d3e6d3febfb17793ac9203", questions: 109, papers: 9 },
};
const FINAL_LABELS_SHA256 = "a2b798169c0a5cfea34bab1c693102293b010c83e792014aeb083e451ade85d3";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

function workspaceRoot() {
  const common = execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
  return resolve(dirname(common), "..");
}
const sourceRoot = process.env.PASTPAPERPREP_IB_CHEMISTRY_SOURCE_ROOT
  ? resolve(process.env.PASTPAPERPREP_IB_CHEMISTRY_SOURCE_ROOT)
  : join(workspaceRoot(), "ib-chemistry-topic-practice/.worktrees/may-2026");
const sourceCommit = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
// The inputs are pinned by SHA-256 below; the checkout only needs to descend from the lane commit.
try {
  execFileSync("git", ["-C", sourceRoot, "merge-base", "--is-ancestor", SOURCE_COMMIT_PREFIX, sourceCommit], { stdio: "ignore" });
} catch {
  throw new Error(`Source checkout at ${sourceCommit} does not descend from ${SOURCE_COMMIT_PREFIX}`);
}
const gitShow = (path) => execFileSync("git", ["-C", root, "show", `${BASE_COMMIT}:${path}`], { maxBuffer: 200_000_000 });
const finalLabelsBytes = readFileSync(join(sourceRoot, "data/classification-2026/final-labels.json"));
if (sha(finalLabelsBytes) !== FINAL_LABELS_SHA256) throw new Error("final-labels.json hash drift");
const finalLabels = JSON.parse(finalLabelsBytes);

const reviewRows = [];
const outputs = new Map();
for (const level of ["HL", "SL"]) {
  const lower = level.toLowerCase();
  const rawPath = `src/data/raw/ib-chemistry-${lower}.json`;
  const baseText = gitShow(rawPath).toString("utf8");
  const base = JSON.parse(baseText);
  if (`${JSON.stringify(base)}\n` !== baseText) throw new Error(`Baseline ${rawPath} is not canonical JSON`);
  const additionsBytes = readFileSync(join(sourceRoot, `site/data/app-additions/ib-chemistry-${lower}-2026.json`));
  if (sha(additionsBytes) !== PINS[level].additions) throw new Error(`${level} additions hash drift`);
  const additions = JSON.parse(additionsBytes);
  if (additions.finalLabelsSha256 !== FINAL_LABELS_SHA256) throw new Error(`${level} additions were built from other labels`);
  if (additions.questions.length !== PINS[level].questions || additions.papers.length !== PINS[level].papers) throw new Error(`${level} addition counts drift`);
  const existing = new Set(base.questions.map((q) => q.id));
  const existingPapers = new Set(base.papers.map((p) => p.id));
  for (const q of additions.questions) {
    if (existing.has(q.id)) throw new Error(`Duplicate question id ${q.id}`);
    if (q.year !== 2026 || q.course !== base.course) throw new Error(`Unexpected addition ${q.id}`);
    const row = finalLabels.rows[q.id];
    if (!row) throw new Error(`No final labels for ${q.id}`);
    reviewRows.push({ id: q.id, level, primary: row.primary, secondaries: row.secondaries, codes: row.codes, confidence: row.confidence, source: row.source, adjudication: row.adjudication ?? null });
  }
  for (const p of additions.papers) if (existingPapers.has(p.id)) throw new Error(`Duplicate paper id ${p.id}`);
  const next = {
    ...base,
    papers: [...base.papers, ...additions.papers],
    questions: [...base.questions, ...additions.questions],
    years: [...base.years, 2026],
    may2026Release: {
      schemaVersion: "ib-chemistry-may-2026-release.v1",
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
  outputs.set(`src/data/raw/ib-chemistry-${lower}.json`, text);
  outputs.set(`src/data/production/ib-chemistry-${lower}.json`, text);
}

const manifest = {
  manifestVersion: "ib-chemistry-may-2026-review.1",
  reviewedQuestionCount: reviewRows.length,
  reviewMethod: "Official May 2026 TZ1-TZ3 questions: a source-grounded primary pass from the question crop and official markscheme, a separate blind second pass from sealed evidence without the primary labels or the Drex triage scores, and a written adjudication of every row where the passes differ (primary, secondaries, official codes, status) or either was low-confidence. Drex (drex-v1.1 requests, answered by drex-v1.5) was used for triage only.",
  sourceCommitPrefix: SOURCE_COMMIT_PREFIX,
  finalLabelsSha256: FINAL_LABELS_SHA256,
  rows: reviewRows.sort((a, b) => a.id.localeCompare(b.id)),
};
outputs.set("docs/audits/ib-chemistry-may-2026-review.json", `${JSON.stringify(manifest, null, 2)}\n`);

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
