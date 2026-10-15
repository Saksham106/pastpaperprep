#!/usr/bin/env node
// Adds the official IB Biology May 2026 papers (HL 160 / SL 123 served questions; one source-incomplete HL question is withheld) to the raw banks.
//
//   node scripts/add-ib-biology-2026.mjs [--check]
//
// Inputs (pinned by SHA-256): the source lane's app additions and adjudicated final labels, from
// branch feat/may-2026-official of ib-biology-topic-practice (override the checkout with
// PASTPAPERPREP_IB_BIOLOGY_SOURCE_ROOT). The baseline is read from the pinned app commit with
// `git show`, never from the working tree, so a rebuild is byte-identical and every earlier row,
// paper and header field is provably unchanged: the 2026 rows are appended after the last 2025
// November row. src/data/production/ib-biology-*.json mirrors the raw files byte for byte, as before.
// Also writes the reviewed-label manifest docs/audits/ib-biology-may-2026-review.json that the
// official-subtopic generator (scripts/generate_ib_biology_official_subtopics.py) reads.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const BASE_COMMIT = "18d8b98df165fad17c4f632e8a156214c27227fa";
const SOURCE_COMMIT_PREFIX = "52a15a9";
const PINS = {
  HL: { additions: "9510f4e7af8ebefc225039fbab6284d781f461e20aa9452955b736acc1496b5f", questions: 161, papers: 9 },
  SL: { additions: "7d456d15d3827d9312142ec296e2b5c58a0fac72c01dbe1f8e03e0cb67e862bd", questions: 123, papers: 9 },
};
const FINAL_LABELS_SHA256 = "c760b8fd094ea2fd576df1cd2b4525381849537ed62dee8d0a7007679d954235";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Source-incomplete questions are not served as ordinary practice. This follows the app's existing
// precedent for them (0455-2026-s-11-q26, 0455-2021-s-22-q1): the row is left out of `questions`, counted
// and recorded with a source-bound reason in the bank header (`may2026Release.excludedFromPractice`), and
// the crops that were already uploaded for it stay in storage untouched. Nothing is invented: no graph
// data, no automatic credit, no reduced printed maxima.
const WITHHELD = {
  "2026-may-tz1-hl-p1b-q2": {
    level: "HL",
    disposition: "excluded_from_practice",
    sourceStatus: "source_graph_removed_for_copyright",
    reason: "The official question paper replaces the graph with a 'Removed for copyright reasons' notice, so parts (a)(i)-(ii) (3 of 8 marks) cannot be answered from the source.",
    source: {
      questionPaperSha256: "b7f3df3a9fbcf5f37a453a89539b7b14561e1537d17b0a9ad628145a04b14a35",
      markschemeSha256: "1a04c44757346002862cb2008eaf7932a2272c1fae02c8d80af6508ca328aab6",
      questionPaperPage: 5,
      notice: "Removed for copyright reasons",
      affectedParts: "(a)(i)-(ii)",
      affectedMarks: 3,
      printedMarks: 8,
      questionCropKey: "ib-biology-hl/questions/2026-may-tz1-hl-p1b-q2-page-5.webp",
      questionCropSha256: "1d2c300c1d51eb2623f77a6228f6324fe12f90db6c8202f9840bf4e408fa874f",
    },
    review: "PR #298 review, 2026-10-15",
  },
};

function workspaceRoot() {
  const common = execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
  return resolve(dirname(common), "..");
}
const sourceRoot = process.env.PASTPAPERPREP_IB_BIOLOGY_SOURCE_ROOT
  ? resolve(process.env.PASTPAPERPREP_IB_BIOLOGY_SOURCE_ROOT)
  : join(workspaceRoot(), "ib-biology-topic-practice/.worktrees/may-2026");
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
const withheldReviewRows = [];
const outputs = new Map();
for (const level of ["HL", "SL"]) {
  const lower = level.toLowerCase();
  const rawPath = `src/data/raw/ib-biology-${lower}.json`;
  const baseText = gitShow(rawPath).toString("utf8");
  const base = JSON.parse(baseText);
  if (`${JSON.stringify(base)}\n` !== baseText) throw new Error(`Baseline ${rawPath} is not canonical JSON`);
  const additionsBytes = readFileSync(join(sourceRoot, `site/data/app-additions/ib-biology-${lower}-2026.json`));
  if (sha(additionsBytes) !== PINS[level].additions) throw new Error(`${level} additions hash drift`);
  const additions = JSON.parse(additionsBytes);
  if (additions.finalLabelsSha256 !== FINAL_LABELS_SHA256) throw new Error(`${level} additions were built from other labels`);
  if (additions.questions.length !== PINS[level].questions || additions.papers.length !== PINS[level].papers) throw new Error(`${level} addition counts drift`);
  const withheld = [];
  const served = [];
  const existing = new Set(base.questions.map((q) => q.id));
  const existingPapers = new Set(base.papers.map((p) => p.id));
  for (const q of additions.questions) {
    if (existing.has(q.id)) throw new Error(`Duplicate question id ${q.id}`);
    if (q.year !== 2026 || q.course !== base.course) throw new Error(`Unexpected addition ${q.id}`);
    const row = finalLabels.rows[q.id];
    if (!row) throw new Error(`No final labels for ${q.id}`);
    const review = { id: q.id, level, codes: row.codes, groups: row.groups, confidence: row.confidence, source: row.source, adjudication: row.adjudication ?? null };
    const hold = WITHHELD[q.id];
    if (hold) {
      if (hold.level !== level || q.marks !== hold.source.printedMarks || q.component !== "P1B") throw new Error(`Withheld row does not match its record: ${q.id}`);
      withheld.push({ id: q.id, disposition: hold.disposition, sourceStatus: hold.sourceStatus, reason: hold.reason, source: hold.source, review: hold.review });
      withheldReviewRows.push(review);
      continue;
    }
    reviewRows.push(review);
    served.push(q);
  }
  for (const id of Object.keys(WITHHELD)) if (WITHHELD[id].level === level && !withheld.some((row) => row.id === id)) throw new Error(`Withheld row is not in the additions: ${id}`);
  for (const p of additions.papers) if (existingPapers.has(p.id)) throw new Error(`Duplicate paper id ${p.id}`);
  const next = {
    ...base,
    papers: [...base.papers, ...additions.papers],
    questions: [...base.questions, ...served],
    years: [...base.years, 2026],
    may2026Release: {
      schemaVersion: "ib-biology-may-2026-release.v1",
      source: "Official IB May 2026 papers and markschemes (papers.xtremepape.rs mirror of the IB release)",
      sourceBranch: "feat/may-2026-official",
      sourceCommitPrefix: SOURCE_COMMIT_PREFIX,
      additionsSha256: PINS[level].additions,
      finalLabelsSha256: FINAL_LABELS_SHA256,
      baseCommit: BASE_COMMIT,
      baseQuestionCount: base.questions.length,
      sourceQuestionCount: additions.questions.length,
      addedQuestionCount: served.length,
      excludedQuestionCount: withheld.length,
      combinedQuestionCount: base.questions.length + served.length,
      addedPaperCount: additions.papers.length,
      excludedFromPractice: withheld,
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
  outputs.set(`src/data/raw/ib-biology-${lower}.json`, text);
  outputs.set(`src/data/production/ib-biology-${lower}.json`, text);
}

const manifest = {
  manifestVersion: "ib-biology-may-2026-review.1",
  reviewedQuestionCount: reviewRows.length,
  withheldQuestionCount: withheldReviewRows.length,
  reviewMethod: "Official May 2026 TZ1-TZ3 questions: a source-grounded primary pass from the question crop and official markscheme, a separate blind second pass from sealed evidence without the primary labels or the Drex triage scores, and a written adjudication of every row where the passes differ (primary, secondaries, groups, status) or either was low-confidence. Drex (drex-v1.1 requests, answered by drex-v1.5) was used for triage only.",
  sourceCommitPrefix: SOURCE_COMMIT_PREFIX,
  finalLabelsSha256: FINAL_LABELS_SHA256,
  rows: reviewRows.sort((a, b) => a.id.localeCompare(b.id)),
  // Reviewed and labelled, but not served as ordinary practice (source-incomplete); see may2026Release.excludedFromPractice.
  withheldRows: withheldReviewRows.sort((a, b) => a.id.localeCompare(b.id)),
};
outputs.set("docs/audits/ib-biology-may-2026-review.json", `${JSON.stringify(manifest, null, 2)}\n`);

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
