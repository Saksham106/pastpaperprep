#!/usr/bin/env node
/** Metadata-only 0654 repair. Reuse the ORIGINAL verified object receipt; never upload. */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { manifestSha256, RELEASE_BANKS, runtimeSha256, sha256 } from "./igcse-release.mjs";
import { createPrivateIndex, TRANSPORT_MAMMALS_REPARENTING_IDS } from "./generate-coordinated-sciences-0654-runtime.mjs";

const BANK = "igcse-coordinated-sciences-0654";
const OLD_COMMIT = "d711b6f26af144cc4d3732d99dd63356b418ba27";
const OLD_RUNTIME_SHA = "712e208ab5c0cef1b2c970bd898eb6d9aa411f7f762e072bf35ecf6c4f2d8ca8";
const OLD_TAXONOMY_SHA = "6fb3a878f1952b5c323e58636a1601455b5df066d6bb4c71fa2c1f2cf499c2c1";
const NEW_TAXONOMY_SHA = "24fdb70e4907faf3e069f9a88e42288b368ae451ee5d4d3bf8809a8b76b15378";
const OLD_MANIFEST_SHA = "a315134b5523e694465fbb4759d14c70f02fe732a6ba6ddbc9cdc1c27fa1005a";
const OLD_RECEIPT_SHA = "2fcf4b04c2da12b57215309698de2ed3b19f0cb29b6d08407cb72514fc6c99ff";
const TARGET_IDS = new Set(TRANSPORT_MAMMALS_REPARENTING_IDS);
function insist(condition, reason) { if (!condition) throw new Error(`0654 taxonomy-only reseal: ${reason}`); }

export function resealTransportTaxonomy({ baseline, oldTaxonomy, taxonomyText, manifestText, receiptText }) {
  insist(baseline?.runtimeArtifact?.runtimeSha256 === OLD_RUNTIME_SHA && runtimeSha256(baseline) === OLD_RUNTIME_SHA, "baseline runtime seal mismatch");
  insist(baseline.releaseStatus === "production" && baseline.assetVerification === "verified_readback", "baseline not finalized");
  insist(sha256(JSON.stringify(oldTaxonomy)) === OLD_TAXONOMY_SHA, "baseline taxonomy mismatch");
  const taxonomy = JSON.parse(taxonomyText);
  insist(sha256(taxonomyText) === NEW_TAXONOMY_SHA, "corrected taxonomy SHA mismatch");
  insist(taxonomy.topics.length === oldTaxonomy.topics.length && taxonomy.details.length === oldTaxonomy.details.length && taxonomy.subtopics.length === oldTaxonomy.subtopics.length, "taxonomy dimensions changed");
  const revised = structuredClone(oldTaxonomy);
  const subtopic = revised.subtopics.find((sub) => sub.id === "B7.2@True");
  insist(subtopic?.title === "Transport in mammals" && subtopic.ownerTopicId === "transport-in-plants", "old legacy subtopic source mismatch");
  subtopic.ownerTopicId = "transport-in-animals";
  subtopic.topicTitle = "Transport in animals";
  let correctedDetails = 0;
  for (const detail of revised.details) {
    if (!/^(?:0654:2019_2021_v3|0654:2022_v1):B7\.2:/.test(detail.id)) continue;
    insist(detail.ownerTopicId === "transport-in-plants", "old legacy detail owner mismatch");
    detail.ownerTopicId = "transport-in-animals";
    correctedDetails++;
  }
  insist(correctedDetails === 30 && isDeepStrictEqual(revised, taxonomy), "taxonomy changed outside the 32 verified owner fields");

  const manifest = JSON.parse(manifestText);
  const receipt = JSON.parse(receiptText);
  insist(manifestSha256(manifest) === OLD_MANIFEST_SHA && sha256(manifestText) === "c3dc5e927f26c9292cf0268f21a03ad4364d741c05505e03b44a838faf2eb75a", "immutable manifest mismatch");
  insist(sha256(receiptText) === OLD_RECEIPT_SHA, "immutable receipt bytes mismatch");
  insist(manifest.bank === BANK && manifest.storageState === "pending_upload" && manifest.originalCandidateRuntimeSha256 === baseline.runtimeArtifact.originalCandidateRuntimeSha256, "immutable manifest identity mismatch");
  insist(receipt.bank === BANK && receipt.storageState === "verified_readback" && receipt.assetManifestSha256 === OLD_MANIFEST_SHA && Array.isArray(receipt.failed) && receipt.failed.length === 0, "receipt state or manifest mismatch");
  insist(baseline.runtimeArtifact.assetManifestSha256 === OLD_MANIFEST_SHA && baseline.runtimeArtifact.storageReceiptSha256 === OLD_RECEIPT_SHA, "baseline asset seal mismatch");
  insist(Array.isArray(manifest.assets) && manifest.assets.length === 15620 && Array.isArray(receipt.completed), "asset counts missing");
  const keySet = new Set(manifest.assets.map((asset) => asset.objectKey));
  const completedSet = new Set(receipt.completed);
  insist(keySet.size === 15620 && completedSet.size === 15620 && receipt.completed.length === 15620 && [...keySet].every((key) => completedSet.has(key)), "receipt incomplete or duplicate object keys");
  const prefix = `${RELEASE_BANKS[BANK].prefix}/`;
  insist(manifest.assets.every((asset) => asset.objectKey.startsWith(prefix) && /^[a-f0-9]{64}$/.test(asset.sha256) && Number.isInteger(asset.size) && asset.size > 0 && asset.contentType === "image/webp"), "asset prefix or hash/size evidence mismatch");
  const referenceSet = new Set();
  for (const q of baseline.questions) {
    for (const ref of [...q.questionImages, ...q.markschemeImages, ...(q.officialMarkscheme?.images ?? [])]) {
      insist(typeof ref === "string" && !ref.includes("..") && (ref.startsWith("questions/") || ref.startsWith("markschemes/")), "unsafe asset reference");
      referenceSet.add(`${prefix}${ref}`);
    }
  }
  insist(referenceSet.size === keySet.size && [...referenceSet].every((key) => keySet.has(key)), "baseline assets do not match verified manifest");

  insist(Array.isArray(baseline.questions) && baseline.questions.length === 4721 && TARGET_IDS.size === 39, "question or target count changed");
  const ids = new Set(baseline.questions.map((q) => q.id));
  insist(ids.size === 4721 && [...TARGET_IDS].every((id) => ids.has(id)), "target IDs missing or duplicated");
  const actual = baseline.questions.filter((q) => q.primaryTopicId === "transport-in-plants" && q.subtopics.includes("Transport in mammals"));
  insist(actual.length === 39 && actual.every((q) => TARGET_IDS.has(q.id)), "source rule has extra or missing rows");
  insist(baseline.questions.filter((q) => q.classificationReviewStatus === "unresolved_taxonomy_gap").length === 4, "unresolved rows changed");
  const output = structuredClone(baseline);
  for (const q of output.questions) {
    insist(q.publicationStatus === "production" && ["classified", "unresolved_taxonomy_gap"].includes(q.classificationReviewStatus), "baseline has unknown question state");
    if (!TARGET_IDS.has(q.id)) continue;
    insist(q.classificationReviewStatus === "classified" && q.primaryTopic === "Transport in plants" && q.primaryTopicId === "transport-in-plants" && q.subtopics.includes("Transport in mammals"), "target source mismatch");
    q.primaryTopic = "Transport in animals";
    q.primaryTopicId = "transport-in-animals";
  }
  output.taxonomy.sha256 = NEW_TAXONOMY_SHA;
  output.runtimeArtifact.releaseTaxonomySha256 = NEW_TAXONOMY_SHA;
  output.runtimeArtifact.runtimeTaxonomySha256 = sha256(JSON.stringify(taxonomy));
  output.runtimeArtifact.finalizedContentSha256 = sha256(JSON.stringify(output.questions));
  output.runtimeArtifact.taxonomyRepair = {
    baselineRuntimeSha256: OLD_RUNTIME_SHA,
    targetIdsSha256: sha256([...TARGET_IDS].sort().join("\n")),
    changedCount: 39,
    correctedTaxonomySha256: NEW_TAXONOMY_SHA,
  };
  output.runtimeArtifact.runtimeSha256 = null;
  output.runtimeArtifact.runtimeSha256 = runtimeSha256(output);
  return output;
}

async function main() {
  insist(process.argv[2] === "--write", "pass --write only after independent gates");
  const root = path.resolve(import.meta.dirname, "..");
  const fromGit = (filename) => execFileSync("git", ["show", `${OLD_COMMIT}:${filename}`], { cwd: root, maxBuffer: 30_000_000 });
  const oldTaxonomy = JSON.parse(fromGit("src/data/igcse-coordinated-sciences-0654-taxonomy.json"));
  const baseline = JSON.parse(fromGit(`src/data/production/${BANK}.json`));
  const [taxonomyText, manifestText, receiptText] = await Promise.all([
    readFile(path.join(root, `src/data/${BANK}-taxonomy.json`), "utf8"),
    readFile(path.join(root, `data/storage/${BANK}.manifest.json`), "utf8"),
    readFile(path.join(root, `data/storage/${BANK}.receipt.json`), "utf8"),
  ]);
  const output = resealTransportTaxonomy({ baseline, oldTaxonomy, taxonomyText, manifestText, receiptText });
  const privateIndex = createPrivateIndex(output);
  await writeFile(path.join(root, `src/data/production/${BANK}.json`), `${JSON.stringify(output)}\n`);
  await writeFile(path.join(root, `src/data/private-index/${BANK}.json`), `${JSON.stringify(privateIndex)}\n`);
  console.log(JSON.stringify({ bank: BANK, changed: 39, questions: output.questions.length, assetManifestSha256: output.runtimeArtifact.assetManifestSha256, storageReceiptSha256: output.runtimeArtifact.storageReceiptSha256, runtimeSha256: output.runtimeArtifact.runtimeSha256 }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
