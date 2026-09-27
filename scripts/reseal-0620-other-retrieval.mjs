#!/usr/bin/env node
/** Exact 30-row Chemistry Other retrieval overlay; historical unresolved provenance stays untouched. */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeSha256, sha256 } from "./igcse-release.mjs";

const BANK = "igcse-chemistry-0620";
const BASE = "197ac22550d5bcb7559eafdbc0ae5cf391924bd5";
const BASE_RUNTIME = "9cf537ce5d68db06762521bb1cd1e57fa1b25fafc79ba2c558a3b993da2d8eba";
const BASE_CONTENT = "4ccfffcc3cd35751cded9749ae85763e6f5725d47cc96fa226c1ee27f409a067";
const MANIFEST = "2b7c46666ece8f3d9bb57a50e3dfe7389a993432656b5215b12d782409fed43b";
const RECEIPT = "935f8c574bd1ef4e7fd1760a13fdec3ce31503144185070df0c76603a225b357";
const COHORT = "740a4b457910ce88c8b588a1e0bcebc98d9f460047ef3fb8076322808f95fa43";
const IDS = "2eea52a294f8a2d2b504c0514f87e6d3dfd403e3319707d91481d91a19679dcc";
const QUEUE = "53dc1b3154fe3ffaa1ec872d3d6efa54c98bfff3cb7863c58cfb6b9cc1793da0";
const assert = (condition, reason) => { if (!condition) throw new Error(`0620 original Other replay: ${reason}`); };

export function reseal0620Other({ baseline, frozen, taxonomy }) {
  assert(runtimeSha256(baseline) === BASE_RUNTIME && baseline.runtimeArtifact?.runtimeSha256 === BASE_RUNTIME, "baseline runtime seal mismatch");
  assert(sha256(JSON.stringify(baseline.questions)) === BASE_CONTENT, "baseline content mismatch");
  assert(baseline.runtimeArtifact.assetManifestSha256 === MANIFEST && baseline.runtimeArtifact.storageReceiptSha256 === RECEIPT, "asset seals changed");
  assert(baseline.releaseStatus === "production" && baseline.publicationStatus === "production" && baseline.assetVerification === "verified_readback", "baseline not finalized");
  assert(baseline.questions.length === 5129 && baseline.questionCount === 5129, "bank count mismatch");
  assert(frozen.baselineCommit === BASE && frozen.frozenOriginalOtherQueueSha256 === QUEUE && sha256(JSON.stringify(frozen)) === COHORT, "cohort evidence changed");
  assert(frozen.syllabi["2019"].sha256 === "f0bfc48982ad7ae572d08ffaa9a6c8a3d4751b5e09b554c17074b0c36b42dd16" &&
    frozen.syllabi["2020"].sha256 === "c54ad83999e7150c7862569d657f9cb4557da4c09dfca56ab937c44e15fa16a4" &&
    frozen.syllabi["2021"].sha256 === frozen.syllabi["2020"].sha256 &&
    frozen.syllabi["2026"].sha256 === "6aab46afe64e4de40a447c36d1bfa382a10e9865eab9230af7915629cf576f0c", "applicable syllabus pins changed");
  assert(frozen.rows.length === 30 && new Set(frozen.rows.map((r) => r.id)).size === 30, "30 unique rows required");
  const ids = frozen.rows.map((r) => r.id).sort();
  assert(sha256(ids.join("\n")) === IDS, "target ID set mismatch");
  const owner = new Map(taxonomy.student_topics.map((t) => [t.label, new Set(t.detailed_subtopics.map((d) => d.label))]));
  const map = new Map(frozen.rows.map((r) => {
    assert(r.questionPaperSha256?.length === 64 && r.markSchemeSha256?.length === 64 &&
      r.qpPages.length > 0 && r.msPages.length > 0 && r.syllabusSection && r.decision &&
      r.jevCandidate && Number.isFinite(r.jevConfidence), `evidence incomplete: ${r.id}`);
    assert(owner.has(r.primaryTopic) && r.details.length > 0 && r.details.every((d) => owner.get(r.primaryTopic).has(d)), `invalid primary ownership: ${r.id}`);
    for (const [secondary, details] of Object.entries(r.secondaryTopics)) {
      assert(secondary !== r.primaryTopic && owner.has(secondary) && details.length > 0 && details.every((d) => owner.get(secondary).has(d)), `invalid secondary ownership: ${r.id}`);
    }
    return [r.id, r];
  }));
  const output = structuredClone(baseline);
  let changed = 0;
  for (const q of output.questions) {
    const r = map.get(q.id);
    if (!r) continue;
    assert(q.primaryTopic === "Other" && q.primaryTopicId === null && q.classificationReviewStatus === "unresolved_taxonomy_gap", `not original Other: ${q.id}`);
    assert(q.classificationProvenance?.sourceRowId === q.id && q.subtopics.length === 0 && q.detailedSubtopics.length === 0 && q.secondaryTopics.length === 0, `unexpected original fields: ${q.id}`);
    q.primaryTopic = r.primaryTopic;
    q.primaryTopicId = r.primaryTopicId;
    q.secondaryTopics = Object.keys(r.secondaryTopics);
    q.subtopics = [...r.details, ...Object.values(r.secondaryTopics).flat()];
    q.detailedSubtopics = [...q.subtopics];
    q.secondarySubtopics = Object.values(r.secondaryTopics).flat();
    changed++;
  }
  assert(changed === 30, "exact target coverage mismatch");
  output.runtimeArtifact.chemistryOtherRetrievalRepair = {
    baselineGitCommit: BASE, baselineRuntimeSha256: BASE_RUNTIME, baselineContentSha256: BASE_CONTENT,
    frozenCohortSha256: COHORT, targetIdsSha256: IDS, frozenOtherQueueSha256: QUEUE,
    changedCount: 30, method: "paired-QP-MS-and-era-syllabus-reviewed; bounded-TypeSafe-Jev-suggestions; retrieval-only; unresolved-provenance-preserved",
  };
  output.runtimeArtifact.finalizedContentSha256 = sha256(JSON.stringify(output.questions));
  output.runtimeArtifact.runtimeSha256 = null;
  output.runtimeArtifact.runtimeSha256 = runtimeSha256(output);
  return output;
}

async function main() {
  const mode = process.argv[2];
  assert(mode === "--write" || mode === "--check", "specify --check or --write");
  const root = path.resolve(import.meta.dirname, "..");
  const fromBase = (filename) => JSON.parse(execFileSync("git", ["show", `${BASE}:${filename}`], { cwd: root, maxBuffer: 50_000_000 }).toString("utf8"));
  const frozen = JSON.parse(await readFile(path.join(root, "scripts/data/0620-other-retrieval-targets.json"), "utf8"));
  const taxonomy = JSON.parse(await readFile(path.join(root, `src/data/${BANK}-taxonomy.json`), "utf8"));
  const [manifestText, receiptText] = await Promise.all([
    readFile(path.join(root, `data/storage/${BANK}.manifest.json`), "utf8"),
    readFile(path.join(root, `data/storage/${BANK}.receipt.json`), "utf8"),
  ]);
  assert(sha256(JSON.stringify(JSON.parse(manifestText))) === MANIFEST && sha256(receiptText) === RECEIPT, "manifest/receipt readback changed");
  const output = reseal0620Other({ baseline: fromBase(`src/data/production/${BANK}.json`), frozen, taxonomy });
  const index = fromBase(`src/data/private-index/${BANK}.json`);
  assert(index.questions.length === 5129, "private index count mismatch");
  const byId = new Map(output.questions.filter((q) => frozen.rows.some((r) => r.id === q.id)).map((q) => [q.id, q]));
  for (const q of index.questions) {
    const target = byId.get(q.id);
    if (target) Object.assign(q, { primaryTopic: target.primaryTopic, secondaryTopics: target.secondaryTopics, subtopics: target.subtopics });
  }
  assert(byId.size === 30, "index coverage mismatch");
  const runtimePath = path.join(root, `src/data/production/${BANK}.json`);
  const indexPath = path.join(root, `src/data/private-index/${BANK}.json`);
  if (mode === "--check") {
    assert(await readFile(runtimePath, "utf8") === `${JSON.stringify(output)}\n`, "runtime differs from exact replay");
    assert(await readFile(indexPath, "utf8") === `${JSON.stringify(index)}\n`, "index differs from exact replay");
  } else {
    await writeFile(runtimePath, `${JSON.stringify(output)}\n`);
    await writeFile(indexPath, `${JSON.stringify(index)}\n`);
  }
  console.log(JSON.stringify({ mode, changed: 30, unchanged: 5099, runtimeSha256: output.runtimeArtifact.runtimeSha256, finalizedContentSha256: output.runtimeArtifact.finalizedContentSha256 }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
