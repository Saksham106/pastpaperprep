#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(process.env.PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT ?? join(root, "..", "ib-economics-topic-practice"));
const sourceCommit = "03c3fb0c1032fb0584547b8a03f3b25b8a3f8755";
const finalClassificationsSha256 = "28088b8f6a4bfd7c1c18ed9b992e1556876cba7a5df16f33353d29d475a011fb";
const releaseInputsSha256 = "0a13dae54741ee95c6f161689461a53ce6033da0e368e888be392bff15fdaf39";
const releaseTaxonomySha256 = "75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c";
const storageReceiptSha256 = "31987a5410ea7325b6bb59e26ee451fbbc7131ece6270040bbd5ab8d27cc1467";
const storageManifestSha256 = "03530b3e2e964821189575d3c6ad287b2145d89b6922e354f08147e1b845aae5";
const storageReceiptPath = resolve(process.env.PASTPAPERPREP_IB_ECONOMICS_STORAGE_RECEIPT ?? join(root, "docs", "ib-economics-storage-receipts", "ib-economics-storage-release-receipt.json"));
const banks = [
  ["ib-economics-hl", "HL", 111, 42, "questions-hl.json"],
  ["ib-economics-sl", "SL", 89, 32, "questions-sl.json"],
];

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function compact(value) { return `${JSON.stringify(value)}\n`; }
function publicQuestion(question) {
  const fields = [
    "id", "number", "paper", "year", "session", "primaryTopic", "secondaryTopics", "skills", "subtopics", "subject",
    "option", "zone", "component", "calculator", "marks", "questionImageHashes", "markschemeImageHashes",
  ];
  return Object.fromEntries(fields.filter((field) => field in question).map((field) => [field, question[field]]));
}
async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
async function writeJson(path, value) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, compact(value), "utf8");
}
async function sourceSha(relative) { return hash(await readFile(join(sourceRoot, relative))); }

const storageReceiptBytes = await readFile(storageReceiptPath);
if (hash(storageReceiptBytes) !== storageReceiptSha256) throw new Error("Economics storage receipt seal mismatch");
const storageReceipt = JSON.parse(storageReceiptBytes);
if (
  storageReceipt.schemaVersion !== "ib-economics-storage-release-receipt-v1" ||
  storageReceipt.status !== "verified-readback" ||
  storageReceipt.sourceCommit !== sourceCommit ||
  storageReceipt.manifestSha256 !== storageManifestSha256 ||
  storageReceipt.provider !== "r2" ||
  storageReceipt.bucket !== "pastpaperprep-assets" ||
  JSON.stringify(storageReceipt.namespaces) !== JSON.stringify(banks.map(([bank]) => `${bank}/`)) ||
  storageReceipt.local?.objectCount !== 1604 ||
  storageReceipt.local?.byteSize !== 78834062 ||
  storageReceipt.final?.objectCount !== 1604 ||
  storageReceipt.final?.byteSize !== 78834062 ||
  storageReceipt.final?.sha256VerifiedByGet !== true
) throw new Error("Economics storage receipt header mismatch");

function assertVerifiedStorageObjects(bank, assets) {
  const expected = new Map(assets.map((asset) => [asset.objectKey, asset]));
  const entries = Object.entries(storageReceipt.objects ?? {}).filter(([key]) => key.startsWith(`${bank}/`));
  if (entries.length !== assets.length) throw new Error(`${bank}: storage receipt object coverage mismatch`);
  for (const [key, receipt] of entries) {
    const asset = expected.get(key);
    if (!asset || receipt.status !== "verified" || receipt.localBytes !== asset.byteSize || receipt.localSha256 !== asset.sha256 || receipt.remoteBytes !== asset.byteSize || receipt.remoteSha256 !== asset.sha256) {
      throw new Error(`${bank}: storage receipt hash mismatch for ${key}`);
    }
  }
}

const sourceFinalSha = await sourceSha("data/classification/final-classifications.json");
const sourceReleaseSha = await sourceSha("data/classification/release-inputs.json");
const sourceTaxonomySha = await sourceSha("data/classification/release-taxonomy.json");
if (sourceFinalSha !== finalClassificationsSha256 || sourceReleaseSha !== releaseInputsSha256 || sourceTaxonomySha !== releaseTaxonomySha256) {
  throw new Error("Economics source seal mismatch; candidate artifacts were not generated");
}

const runtimeDir = join(root, "src/data/production");
const privateIndexDir = join(root, "src/data/private-index");
const manifestDir = join(root, "docs/ib-economics-asset-manifests");
await mkdir(runtimeDir, { recursive: true });
await mkdir(privateIndexDir, { recursive: true });
await mkdir(manifestDir, { recursive: true });
const sealManifest = {
  schemaVersion: "ib-economics-runtime-seal-v1",
  sourceRepository: "ib-economics-topic-practice",
  sourceCommit,
  finalClassificationsSha256,
  releaseInputsSha256,
  releaseTaxonomySha256,
  storageReceiptSha256,
  storageManifestSha256,
  storageObjectCount: storageReceipt.final.objectCount,
  storageByteSize: storageReceipt.final.byteSize,
  banks: {},
};
const allAssets = [];

for (const [bank, level, questionCount, paperCount, sourceFile] of banks) {
  const source = await readJson(join(sourceRoot, "site/data", sourceFile));
  if (source.questions.length !== questionCount || source.papers.length !== paperCount || source.level !== level) throw new Error(`${bank}: source count/level mismatch`);
  for (const question of source.questions) {
    if (question.bankSlug !== bank || question.id !== question.canonicalId) throw new Error(`${bank}: canonical identity mismatch`);
    if (question.classificationEvidence?.finalArtifactSha256 !== finalClassificationsSha256 || question.classificationReviewStatus !== "semantic_qa_approved") throw new Error(`${bank}: classification provenance mismatch for ${question.id}`);
    if (!String(question.sourceQuestionUrl ?? "").startsWith("https://") || !String(question.sourceMarkSchemeUrl ?? "").startsWith("https://")) throw new Error(`${bank}: source URL missing for ${question.id}`);
    for (const path of [...(question.questionImages ?? []), ...(question.markschemeImages ?? [])]) {
      if (!path.endsWith(".webp") || path.includes("..") || path.startsWith("/")) throw new Error(`${bank}: unsafe derived asset path for ${question.id}`);
    }
  }
  const runtime = {
    ...source,
    releaseStatus: "published",
    rightsStatus: "user_attested_non_blocking_for_named_corpus",
    runtimeArtifact: {
      schemaVersion: "ib-economics-normalized-runtime-v1",
      sourceRepository: "ib-economics-topic-practice",
      sourceCommit,
      finalClassificationsSha256,
      releaseInputsSha256,
      releaseTaxonomySha256,
      published: true,
      assetVerification: "verified_readback",
      storageReceiptSha256,
      assetManifestSha256: storageManifestSha256,
      storageObjectCount: storageReceipt.final.objectCount,
      storageByteSize: storageReceipt.final.byteSize,
      contentSha256: hash(JSON.stringify(source.questions)),
    },
  };
  const runtimePath = join(runtimeDir, `${bank}.json`);
  await writeJson(runtimePath, runtime);

  const assets = new Map();
  for (const question of source.questions) {
    for (const [kind, paths] of [["question", question.questionImages ?? []], ["markscheme", question.markschemeImages ?? []]]) {
      for (const relativeAsset of paths) {
        const sourcePath = `site/assets/ib-economics/${relativeAsset}`;
        const objectKey = `${bank}/${relativeAsset}`;
        const bytes = await readFile(join(sourceRoot, sourcePath));
        const item = assets.get(objectKey) ?? {
          objectKey, sourcePath, kind, byteSize: bytes.byteLength, sha256: hash(bytes), referencedQuestionIds: [],
        };
        if (item.byteSize !== bytes.byteLength || item.sha256 !== hash(bytes)) throw new Error(`${bank}: asset changed during manifest build`);
        if (!item.referencedQuestionIds.includes(question.id)) item.referencedQuestionIds.push(question.id);
        assets.set(objectKey, item);
      }
    }
  }
  const manifestAssets = [...assets.values()]
    .sort((a, b) => a.objectKey.localeCompare(b.objectKey))
    .map((asset) => ({ ...asset, referencedQuestionIds: [...asset.referencedQuestionIds].sort() }));
  assertVerifiedStorageObjects(bank, manifestAssets);
  allAssets.push(...manifestAssets);
  const assetManifest = {
    schemaVersion: "ib-economics-derived-asset-upload-manifest-v1",
    bank,
    sourceRepository: "ib-economics-topic-practice",
    sourceCommit,
    sourceRuntimeFile: `src/data/production/${bank}.json`,
    upload: false,
    rawPdfIncluded: false,
    assets: manifestAssets,
  };
  const assetManifestPath = join(manifestDir, `${bank}-upload-manifest.json`);
  await writeJson(assetManifestPath, assetManifest);

  const privateIndex = {
    schemaVersion: "ib-economics-private-index-v1",
    bank,
    runtimeArtifact: runtime.runtimeArtifact,
    questions: source.questions.map(publicQuestion),
  };
  const privateIndexPath = join(privateIndexDir, `${bank}.json`);
  await writeJson(privateIndexPath, privateIndex);
  sealManifest.banks[bank] = {
    level,
    questionCount,
    paperCount,
    runtimeFileSha256: hash(await readFile(runtimePath)),
    privateIndexSha256: hash(await readFile(privateIndexPath)),
    assetManifestSha256: hash(await readFile(assetManifestPath)),
    contentSha256: runtime.runtimeArtifact.contentSha256,
    assetCount: assetManifest.assets.length,
  };
}
const actualManifestSha256 = hash(JSON.stringify(allAssets.sort((a, b) => a.objectKey.localeCompare(b.objectKey))));
if (actualManifestSha256 !== storageManifestSha256 || allAssets.length !== storageReceipt.final.objectCount) {
  throw new Error("Economics storage manifest identity mismatch");
}
await writeJson(join(root, "src/data/ib-economics-runtime-manifest.json"), sealManifest);
console.log(JSON.stringify({ sourceRoot, banks: sealManifest.banks }, null, 2));
