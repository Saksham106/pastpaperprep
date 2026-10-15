import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const CANDIDATE_CONTENT_FILES = Object.freeze([
  "src/data/raw/ib-biology-hl.json",
  "src/data/raw/ib-biology-sl.json",
  "src/data/raw/ib-chemistry-hl.json",
  "src/data/raw/ib-chemistry-sl.json",
  "src/data/raw/ib-physics-hl.json",
  "src/data/raw/ib-physics-sl.json",
  "src/data/private-index/ib-biology-hl.json",
  "src/data/private-index/ib-biology-sl.json",
  "src/data/private-index/ib-chemistry-hl.json",
  "src/data/private-index/ib-chemistry-sl.json",
  "src/data/private-index/ib-physics-hl.json",
  "src/data/private-index/ib-physics-sl.json",
  "docs/ib-science-storage/ib-biology-hl.pending-upload-manifest.json",
  "docs/ib-science-storage/ib-biology-sl.pending-upload-manifest.json",
  "docs/ib-science-storage/ib-chemistry-hl.pending-upload-manifest.json",
  "docs/ib-science-storage/ib-chemistry-sl.pending-upload-manifest.json",
  "docs/ib-science-storage/ib-physics-hl.pending-upload-manifest.json",
  "docs/ib-science-storage/ib-physics-sl.pending-upload-manifest.json",
  "docs/ib-science-extension/biology-source-receipt.json",
  "docs/ib-science-extension/chemistry-source-receipt.json",
  "docs/ib-science-extension/physics-source-receipt.json",
]);

/**
 * The 2016-2019 candidate was sealed on the runtime as of that release. IB Biology later appended the
 * official May 2026 papers (scripts/add-ib-biology-2026.mjs), which leaves every earlier row, paper and
 * header field untouched and records the append in `may2026Release`. This returns the bytes the seal
 * covers: the file with that append removed again, so the seal keeps proving the sealed content is intact.
 */
export function sealedRuntimeBytes(path, bytes) {
  if (!/^src\/data\/raw\/ib-biology-(hl|sl)\.json$/.test(path)) return bytes;
  const { may2026Release, ...rest } = JSON.parse(bytes.toString("utf8"));
  if (!may2026Release) return bytes;
  const sealed = {
    ...rest,
    papers: rest.papers.slice(0, rest.papers.length - may2026Release.addedPaperCount),
    questions: rest.questions.slice(0, may2026Release.baseQuestionCount),
    years: rest.years.filter(year => year !== 2026),
  };
  return Buffer.from(`${JSON.stringify(sealed)}\n`);
}

export function candidateContentManifest(root) {
  return CANDIDATE_CONTENT_FILES.map(path => ({ path, sha256: receiptSha256(sealedRuntimeBytes(path, readFileSync(join(root, path)))) }));
}

export function candidateContentSha256(root) {
  return receiptSha256(JSON.stringify(candidateContentManifest(root)));
}

export const EXPECTED_RECEIPT_SHA256 = Object.freeze({
  chemistry: "8c7bd64eff664b90ed4287b138c8a9d2ea88e7eafecef91ae850ab8107b72dd9",
  biology: "399d07f38afa5818ca9d176747a3a6b9369e615de162f9c7a755b9402ba2599f",
  physics: "057bbec9a7392dd2a1ccacec9d69efbe909bc9149c1d9ae48f9bb3fbad0656f7",
});

export function receiptSha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertPinnedReceipt(key, bytes) {
  const actual = receiptSha256(bytes);
  const expected = EXPECTED_RECEIPT_SHA256[key];
  if (!expected) throw new Error(`${key}: missing immutable receipt pin`);
  if (actual !== expected) throw new Error(`${key}: receipt hash mismatch ${actual} != ${expected}`);
  return actual;
}
