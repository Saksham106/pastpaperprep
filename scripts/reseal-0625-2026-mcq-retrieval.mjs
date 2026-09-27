#!/usr/bin/env node
/** Exact-14 Physics 2026 MCQ retrieval overlay; source assets and old classifications are immutable. */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeSha256, sha256 } from "./igcse-release.mjs";

const BANK = "igcse-physics-0625";
const BASE = "0a0b2246e269c03f81669548947d011c4f68b741";
const BASE_RUNTIME = "714a82e94575d0750423731675d284600ca9c5d6ddc3461758ab2809f6f666f2";
const BASE_FINAL_CONTENT = "5fcd5092d799040bfe3b71c11541fc63a0d2f548556355bef301945c21aa546d";
const MANIFEST = "82a09dc72b46895d6840b23dc65c88f5a0c839fb928f230e60184d01de97ea95";
const RECEIPT = "0a7823e1b04caa03c34a88dd4cdaa1adf3ed7238c5b4e3025d9c44a514cd018f";
const COHORT = "581d6279f401f08615f94b07cd7bfaba4f58f20fb4f2fcd3bbfb4f89cc03dfa2";
const IDS = "bc3b01e37b3d2a122d18c612a1471b3cc4bcb92e34af9f1c606b42ec6a714dd2";
const SYLLABUS = "baaf59f84543beb133ea87cbf8cfb0e8bf105a360cce5009cf57d3ae0a357075";
const assert = (condition, reason) => { if (!condition) throw new Error(`0625 2026 MCQ reseal: ${reason}`); };

export function reseal2026({ baseline, frozen, manifestText, receiptText }) {
  assert(runtimeSha256(baseline) === BASE_RUNTIME && baseline.runtimeArtifact?.runtimeSha256 === BASE_RUNTIME, "baseline runtime seal mismatch");
  assert(baseline.runtimeArtifact?.finalizedContentSha256 === BASE_FINAL_CONTENT, "previous repair content mismatch");
  assert(baseline.runtimeArtifact?.practicalRoleRepair?.changedCount === 144, "prior practical role repair missing");
  assert(sha256(JSON.stringify(frozen)) === COHORT && frozen.baselineCommit === BASE, "cohort evidence changed");
  assert(frozen.official2026Syllabus?.sha256 === SYLLABUS && frozen.frozenOtherQueueSha256 === "53dc1b3154fe3ffaa1ec872d3d6efa54c98bfff3cb7863c58cfb6b9cc1793da0", "source/era pin mismatch");
  assert(sha256(JSON.stringify(JSON.parse(manifestText))) === MANIFEST && sha256(receiptText) === RECEIPT, "immutable manifest or verified receipt changed");
  assert(baseline.runtimeArtifact?.assetManifestSha256 === MANIFEST && baseline.runtimeArtifact?.storageReceiptSha256 === RECEIPT, "runtime asset seal mismatch");
  assert(baseline.releaseStatus === "production" && baseline.publicationStatus === "production" && baseline.assetVerification === "verified_readback", "baseline not finalized");
  assert(baseline.questions.length === 5789 && baseline.questionCount === 5789, "bank count mismatch");
  assert(frozen.rows.length === 14 && new Set(frozen.rows.map((r) => r[0])).size === 14, "target count/uniqueness mismatch");
  const ids = frozen.rows.map((r) => r[0]).sort();
  assert(sha256(ids.join("\n")) === IDS && frozen.targetIdsSha256 === IDS, "exact target ID set mismatch");
  const mapping = new Map(frozen.rows.map(([id, key, reason]) => {
    const label = frozen.labels[key];
    assert(label?.length === 4 && typeof reason === "string" &&
      ((id === "0625-2026-m-12-q1" && key === "broad_only" && label[2] === null && reason.startsWith("broad-only:")) ||
       (id !== "0625-2026-m-12-q1" && typeof label[2] === "string" && typeof label[3] === "string")), `missing or misleading decision for ${id}`);
    const paper = id.replace(/-q\d+$/, "");
    assert(frozen.sourcePairs[paper]?.length === 2, `source pair missing for ${id}`);
    return [id, label];
  }));
  const output = structuredClone(baseline);
  let changed = 0;
  for (const q of output.questions) {
    const label = mapping.get(q.id);
    if (!label) continue;
    assert(q.year === 2026 && q.paper <= 2 && q.marks === 1, `not a 2026 MCQ: ${q.id}`);
    assert(q.classificationReviewStatus === "unresolved_taxonomy_gap" && q.primaryTopic === null && q.primaryTopicId === null && q.subtopics.length === 0 && q.detailedSubtopics.length === 0, `row not unresolved: ${q.id}`);
    assert(q.classificationProvenance?.sourceRowId === q.id, `source identity drift: ${q.id}`);
    q.primaryTopic = label[0];
    q.primaryTopicId = label[1];
    q.subtopics = label[2] === null ? [] : [label[2]];
    q.detailedSubtopics = label[2] === null ? [] : [label[2]];
    changed++;
  }
  assert(changed === 14, "runtime target coverage mismatch");
  output.runtimeArtifact.mcqRetrievalRepair = {
    baselineGitCommit: BASE,
    baselineRuntimeSha256: BASE_RUNTIME,
    baselineFinalizedContentSha256: BASE_FINAL_CONTENT,
    frozenCohortSha256: COHORT,
    targetIdsSha256: IDS,
    syllabusSha256: SYLLABUS,
    changedCount: 14,
    broadOnlyCount: 1,
    method: "source-and-syllabus-reviewed-2026-mcqs; TypeSafe-Jev-bounded-agreement; retrieval-only; original-gaps-retained",
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
  const frozen = JSON.parse(await readFile(path.join(root, "scripts/data/0625-2026-mcq-retrieval-targets.json"), "utf8"));
  const [manifestText, receiptText] = await Promise.all([
    readFile(path.join(root, `data/storage/${BANK}.manifest.json`), "utf8"),
    readFile(path.join(root, `data/storage/${BANK}.receipt.json`), "utf8"),
  ]);
  const output = reseal2026({ baseline: JSON.parse(fromBase(`src/data/production/${BANK}.json`)), frozen, manifestText, receiptText });
  const index = JSON.parse(fromBase(`src/data/private-index/${BANK}.json`));
  assert(index.questions.length === 5789, "private index count mismatch");
  const targets = new Map(output.questions.filter((q) => frozen.rows.some(([id]) => id === q.id)).map((q) => [q.id, q]));
  for (const q of index.questions) {
    const target = targets.get(q.id);
    if (target) Object.assign(q, { primaryTopic: target.primaryTopic, subtopics: target.subtopics });
  }
  assert(targets.size === 14, "private index target coverage mismatch");
  if (mode === "--check") {
    const [publishedRuntime, publishedIndex] = await Promise.all([
      readFile(path.join(root, `src/data/production/${BANK}.json`), "utf8"),
      readFile(path.join(root, `src/data/private-index/${BANK}.json`), "utf8"),
    ]);
    assert(publishedRuntime === `${JSON.stringify(output)}\n`, "runtime replay differs");
    assert(publishedIndex === `${JSON.stringify(index)}\n`, "private index replay differs");
  } else {
    await writeFile(path.join(root, `src/data/production/${BANK}.json`), `${JSON.stringify(output)}\n`);
    await writeFile(path.join(root, `src/data/private-index/${BANK}.json`), `${JSON.stringify(index)}\n`);
  }
  console.log(JSON.stringify({ mode, changed: 14, unchanged: 5775, runtimeSha256: output.runtimeArtifact.runtimeSha256, contentSha256: output.runtimeArtifact.finalizedContentSha256 }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
