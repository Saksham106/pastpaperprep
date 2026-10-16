#!/usr/bin/env node
/** Physics 0625 written-paper marks reseal: question totals from the printed papers. Assets and classifications are untouched. */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeSha256, sha256 } from "./igcse-release.mjs";

const BANK = "igcse-physics-0625";
// The MCQ retrieval reseal (#124) is the last change to the runtime; chain from it.
const BASE = "197ac22550d5bcb7559eafdbc0ae5cf391924bd5";
const BASE_RUNTIME = "1a7f251dc51b3a86669edaad6bb60ba2b8b703d8b58a294f51acda74b090785c";
const BASE_FINAL_CONTENT = "f698083fe8ee260d5bc1da3a9df8fe49094c6d5e0713aea58996a398e95d318f";
const MANIFEST = "82a09dc72b46895d6840b23dc65c88f5a0c839fb928f230e60184d01de97ea95";
const RECEIPT = "0a7823e1b04caa03c34a88dd4cdaa1adf3ed7238c5b4e3025d9c44a514cd018f";
const PAPER_MAX = { 3: 80, 4: 80, 5: 40, 6: 40 };
const assert = (condition, reason) => { if (!condition) throw new Error(`0625 printed marks reseal: ${reason}`); };

/** Every written paper must reconcile: one row per stored question and totals summing to the paper maximum. */
export function censusTargets(baseline, census) {
  assert(census.schemaVersion === "igcse-physics-0625-printed-marks-census-v1", "census schema changed");
  const written = baseline.questions.filter((q) => /^[3-6]/.test(q.component));
  const byPaper = new Map();
  for (const q of written) byPaper.set(q.id.replace(/-q\d+$/, ""), (byPaper.get(q.id.replace(/-q\d+$/, "")) ?? 0) + 1);
  assert(Object.keys(census.papers).length === byPaper.size, "census does not cover every written paper");
  const targets = new Map();
  for (const [paper, entry] of Object.entries(census.papers)) {
    const max = PAPER_MAX[paper.split("-").at(-1)[0]];
    assert(entry.paperMax === max, `${paper}: printed maximum ${entry.paperMax} is not ${max}`);
    assert(/^[a-f0-9]{64}$/.test(entry.qpSha256), `${paper}: question paper hash missing`);
    assert(entry.questions.length === byPaper.get(paper), `${paper}: question count differs from the runtime`);
    assert(entry.questions.reduce((sum, row) => sum + row[2], 0) === max, `${paper}: printed totals do not sum to ${max}`);
    entry.questions.forEach(([number, stored, printed, from], i) => {
      assert(number === i + 1 && Number.isInteger(printed) && printed > 0, `${paper}: bad row ${number}`);
      assert(from === "total" || from === "single-part-mark", `${paper}-q${number}: unknown evidence ${from}`);
      targets.set(`${paper}-q${number}`, { stored, printed });
    });
  }
  return targets;
}

export function resealMarks({ baseline, census, manifestText, receiptText }) {
  assert(runtimeSha256(baseline) === BASE_RUNTIME && baseline.runtimeArtifact?.runtimeSha256 === BASE_RUNTIME, "baseline runtime seal mismatch");
  assert(baseline.runtimeArtifact?.finalizedContentSha256 === BASE_FINAL_CONTENT, "previous repair content mismatch");
  assert(baseline.runtimeArtifact?.mcqRetrievalRepair?.changedCount === 14, "prior MCQ retrieval reseal missing");
  assert(sha256(JSON.stringify(JSON.parse(manifestText))) === MANIFEST && sha256(receiptText) === RECEIPT, "immutable manifest or verified receipt changed");
  assert(baseline.releaseStatus === "production" && baseline.publicationStatus === "production" && baseline.assetVerification === "verified_readback", "baseline not finalized");
  assert(baseline.questions.length === 5789 && baseline.questionCount === 5789, "bank count mismatch");
  const targets = censusTargets(baseline, census);
  const output = structuredClone(baseline);
  let changed = 0;
  for (const q of output.questions) {
    const target = targets.get(q.id);
    if (!target) { assert(!/^[3-6]/.test(q.component), `written question missing from census: ${q.id}`); continue; }
    assert(q.marks === target.stored && q.maxMarks === target.stored, `${q.id}: stored marks drifted from the census`);
    if (q.marks === target.printed) continue;
    q.marks = target.printed;
    q.maxMarks = target.printed;
    changed++;
  }
  output.runtimeArtifact.printedMarksRepair = {
    baselineGitCommit: BASE,
    baselineRuntimeSha256: BASE_RUNTIME,
    baselineFinalizedContentSha256: BASE_FINAL_CONTENT,
    censusSha256: sha256(JSON.stringify(census)),
    writtenQuestionCount: targets.size,
    changedCount: changed,
    method: "printed question totals from the question-paper text layer; every written paper reconciles to its printed maximum; MCQ papers unchanged",
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
  const fromBase = (filename) => execFileSync("git", ["show", `${BASE}:${filename}`], { cwd: root, maxBuffer: 50_000_000 }).toString("utf8");
  const census = JSON.parse(await readFile(path.join(root, "scripts/data/0625-printed-marks-census.json"), "utf8"));
  const [manifestText, receiptText] = await Promise.all([
    readFile(path.join(root, `data/storage/${BANK}.manifest.json`), "utf8"),
    readFile(path.join(root, `data/storage/${BANK}.receipt.json`), "utf8"),
  ]);
  const output = resealMarks({ baseline: JSON.parse(fromBase(`src/data/production/${BANK}.json`)), census, manifestText, receiptText });
  const index = JSON.parse(fromBase(`src/data/private-index/${BANK}.json`));
  assert(index.questions.length === 5789, "private index count mismatch");
  const marks = new Map(output.questions.map((q) => [q.id, q.marks]));
  for (const q of index.questions) {
    assert(marks.has(q.id), `private index row missing in runtime: ${q.id}`);
    q.marks = marks.get(q.id);
  }
  const runtimeText = `${JSON.stringify(output)}\n`;
  const indexText = `${JSON.stringify(index)}\n`;
  if (mode === "--check") {
    const [publishedRuntime, publishedIndex] = await Promise.all([
      readFile(path.join(root, `src/data/production/${BANK}.json`), "utf8"),
      readFile(path.join(root, `src/data/private-index/${BANK}.json`), "utf8"),
    ]);
    assert(publishedRuntime === runtimeText, "runtime replay differs");
    assert(publishedIndex === indexText, "private index replay differs");
  } else {
    await writeFile(path.join(root, `src/data/production/${BANK}.json`), runtimeText);
    await writeFile(path.join(root, `src/data/private-index/${BANK}.json`), indexText);
  }
  const { changedCount, writtenQuestionCount } = output.runtimeArtifact.printedMarksRepair;
  console.log(JSON.stringify({ mode, written: writtenQuestionCount, changed: changedCount, runtimeSha256: output.runtimeArtifact.runtimeSha256, contentSha256: output.runtimeArtifact.finalizedContentSha256 }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
