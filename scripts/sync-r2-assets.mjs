#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(REPO_ROOT, "..");
const BUCKET = process.env.R2_BUCKET_NAME ?? "pastpaperprep-assets";
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_SYNC_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SYNC_SECRET_ACCESS_KEY;
const CONCURRENCY = Number(process.env.UPLOAD_CONCURRENCY ?? 16);
const VERIFY_ONLY = process.argv.includes("--verify-only");
const IGCSE_SOURCE_ROOT = process.env.PASTPAPERPREP_IGCSE_0580_SOURCE_ROOT
  ? resolve(process.env.PASTPAPERPREP_IGCSE_0580_SOURCE_ROOT)
  : join(WORKSPACE_ROOT, "igcse-0580-topic-practice/site");

const SOURCES = [
  { bank: "igcse", root: IGCSE_SOURCE_ROOT, raw: join(REPO_ROOT, "src/data/raw/igcse.json"), imageFields: ["questionImages", "markschemeImages"] },
  { bank: "igcse-additional", root: join(WORKSPACE_ROOT, "igcse-additional-mathematics-0606-topic-practice-full-audit-final/site"), raw: join(REPO_ROOT, "src/data/raw/igcse-additional.json"), imageFields: ["questionImages", "markschemeImages"] },
  { bank: "ib-hl", root: join(WORKSPACE_ROOT, "ib-maths-aa-hl-topic-practice/site"), raw: join(REPO_ROOT, "src/data/raw/ib-hl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-sl", root: join(WORKSPACE_ROOT, "ib-maths-aa-topic-finder-audit/site"), raw: join(REPO_ROOT, "src/data/raw/ib-sl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-ai-hl", root: join(WORKSPACE_ROOT, "ib-maths-ai-hl-topic-practice-full-audit-final/site"), raw: join(REPO_ROOT, "src/data/raw/ib-ai-hl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-ai-sl", root: join(WORKSPACE_ROOT, "ib-maths-ai-sl-topic-practice-audit-fix-ai-sl/site"), raw: join(REPO_ROOT, "src/data/raw/ib-ai-sl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-chemistry-hl", root: join(WORKSPACE_ROOT, "ib-chemistry-topic-practice/site"), raw: join(REPO_ROOT, "src/data/raw/ib-chemistry-hl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-chemistry-sl", root: join(WORKSPACE_ROOT, "ib-chemistry-topic-practice/site"), raw: join(REPO_ROOT, "src/data/raw/ib-chemistry-sl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-physics-hl", root: join(WORKSPACE_ROOT, "ib-physics-topic-practice/site"), raw: join(REPO_ROOT, "src/data/raw/ib-physics-hl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-physics-sl", root: join(WORKSPACE_ROOT, "ib-physics-topic-practice/site"), raw: join(REPO_ROOT, "src/data/raw/ib-physics-sl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-biology-hl", root: join(WORKSPACE_ROOT, "ib-biology-topic-practice/site"), raw: join(REPO_ROOT, "src/data/raw/ib-biology-hl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-biology-sl", root: join(WORKSPACE_ROOT, "ib-biology-topic-practice/site"), raw: join(REPO_ROOT, "src/data/raw/ib-biology-sl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
];

export { SOURCES };

export function selectSources(value = process.env.R2_SYNC_BANKS) {
  if (!value) return SOURCES;
  const requested = [...new Set(value.split(",").map((bank) => bank.trim()).filter(Boolean))];
  if (!requested.length) throw new Error("R2_SYNC_BANKS must name at least one bank.");
  const byBank = new Map(SOURCES.map((source) => [source.bank, source]));
  const unknown = requested.filter((bank) => !byBank.has(bank));
  if (unknown.length) throw new Error(`Unknown R2_SYNC_BANKS: ${unknown.join(", ")}`);
  return requested.map((bank) => byBank.get(bank));
}

function createClient() {
  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error("R2_ACCOUNT_ID, R2_SYNC_ACCESS_KEY_ID, and R2_SYNC_SECRET_ACCESS_KEY are required.");
  }
  if (!/^[a-f0-9]{32}$/i.test(ACCOUNT_ID) || BUCKET !== "pastpaperprep-assets") {
    throw new Error("Refusing to continue: invalid R2 account ID or bucket name.");
  }
  if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1 || CONCURRENCY > 32) {
    throw new Error("UPLOAD_CONCURRENCY must be an integer from 1 to 32.");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  });
}

function referenceValues(question, source) {
  const values = [];
  for (const field of source.imageFields) {
    if (!Object.hasOwn(question, field) || !Array.isArray(question[field])) {
      throw new Error(`Missing ${field} array in ${source.bank} runtime question ${String(question.id)}`);
    }
    values.push(...question[field]);
  }
  if (source.officialMarkschemeImages) {
    if (!Object.hasOwn(question, "officialMarkscheme")) {
      throw new Error(`Missing officialMarkscheme in ${source.bank} runtime question ${String(question.id)}`);
    }
    const official = question.officialMarkscheme;
    if (official === null) return values;
    if (typeof official !== "object" || Array.isArray(official) || !Array.isArray(official.images)) {
      throw new Error(`Invalid officialMarkscheme.images in ${source.bank} runtime question ${String(question.id)}`);
    }
    values.push(...official.images);
  }
  return values;
}

function assertSafeReference(source, reference, rootPath) {
  if (typeof reference !== "string" || !reference.endsWith(".webp") || reference.startsWith("/") || reference.includes("\\")) {
    throw new Error(`Invalid referenced ${source.bank} asset: ${String(reference)}`);
  }
  const segments = reference.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Referenced ${source.bank} asset escapes source root: ${reference}`);
  }
  const absolute = resolve(rootPath, reference);
  if (absolute !== rootPath && !absolute.startsWith(`${rootPath}${sep}`)) {
    throw new Error(`Referenced ${source.bank} asset escapes source root: ${reference}`);
  }
  return absolute;
}

export async function referencedWebpFiles(source) {
  if (!source.raw) throw new Error(`Missing runtime JSON path for ${source.bank}`);
  const raw = JSON.parse(await readFile(source.raw, "utf8"));
  if (!raw || !Array.isArray(raw.questions)) throw new Error(`Invalid runtime JSON questions for ${source.bank}`);
  const rootPath = await realpath(source.root);
  const relativePaths = new Set();
  for (const question of raw.questions) {
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      throw new Error(`Invalid runtime question in ${source.bank}`);
    }
    for (const reference of referenceValues(question, source)) {
      const absolute = assertSafeReference(source, reference, rootPath);
      let actualPath;
      try {
        actualPath = await realpath(absolute);
      } catch {
        throw new Error(`Missing referenced ${source.bank} asset: ${reference}`);
      }
      if (actualPath !== rootPath && !actualPath.startsWith(`${rootPath}${sep}`)) {
        throw new Error(`Referenced ${source.bank} asset escapes source root: ${reference}`);
      }
      relativePaths.add(reference);
    }
  }
  return [...relativePaths].sort().map((relativePath) => ({ path: join(rootPath, relativePath), relative: relativePath }));
}

async function md5(path) {
  const hash = createHash("md5");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function localManifest(sources = SOURCES, concurrency = CONCURRENCY) {
  const groups = await Promise.all(sources.map(async (source) => {
    const files = await referencedWebpFiles(source);
    return files.map((file) => ({
      key: `${source.bank}/${file.relative.split(sep).join("/")}`,
      path: file.path,
      size: 0,
      etag: "",
    }));
  }));
  const entries = groups.flat().sort((a, b) => a.key.localeCompare(b.key));
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= entries.length) return;
      const metadata = await stat(entries[index].path);
      entries[index].size = metadata.size;
      entries[index].etag = await md5(entries[index].path);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, entries.length)) }, worker));
  return entries;
}

async function remoteManifest(client, sources) {
  const prefixes = sources.map((source) => `${source.bank}/`);
  const objects = [];
  let continuationToken;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));
    for (const object of page.Contents ?? []) {
      if (!object.Key) continue;
      if (!prefixes.some((prefix) => object.Key.startsWith(prefix))) continue;
      objects.push({
        key: object.Key,
        size: object.Size ?? -1,
        etag: (object.ETag ?? "").replaceAll('"', "").toLowerCase(),
      });
    }
    continuationToken = page.NextContinuationToken;
  } while (continuationToken);
  return objects.sort((a, b) => a.key.localeCompare(b.key));
}

function reconcile(local, remote) {
  const remoteByKey = new Map(remote.map((item) => [item.key, item]));
  const missing = [];
  const mismatched = [];
  for (const item of local) {
    const candidate = remoteByKey.get(item.key);
    if (!candidate) missing.push(item);
    else if (candidate.size !== item.size || candidate.etag !== item.etag) mismatched.push(item);
  }
  const localKeys = new Set(local.map((item) => item.key));
  const unexpected = remote.filter((item) => !localKeys.has(item.key));
  return { missing, mismatched, unexpected };
}

async function main() {
  const client = createClient();
  const sources = selectSources();
  const local = await localManifest(sources);
  const localBytes = local.reduce((sum, item) => sum + item.size, 0);
  let remote = await remoteManifest(client, sources);
  let result = reconcile(local, remote);

  console.log(`Local: ${local.length.toLocaleString()} objects, ${localBytes.toLocaleString()} bytes.`);
  console.log(`R2 before: ${remote.length.toLocaleString()} objects; ${result.missing.length} missing, ${result.mismatched.length} mismatched, ${result.unexpected.length} unexpected.`);

  if (!VERIFY_ONLY) {
    const pending = [...result.missing, ...result.mismatched];
    let next = 0;
    let uploaded = 0;
    let failed = 0;
    const errors = [];

    async function worker() {
      while (true) {
        const index = next++;
        if (index >= pending.length) return;
        const item = pending[index];
        try {
          await client.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: item.key,
            Body: await readFile(item.path),
            ContentLength: item.size,
            ContentType: "image/webp",
            CacheControl: "private, max-age=31536000, immutable",
          }));
          uploaded++;
        } catch (error) {
          failed++;
          if (errors.length < 20) errors.push(`${item.key}: ${String(error)}`);
        }
        const complete = uploaded + failed;
        if (complete % 250 === 0 || complete === pending.length) {
          console.log(`${complete}/${pending.length}: ${uploaded} uploaded, ${failed} failed`);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, pending.length)) }, worker));
    if (failed) {
      console.error(errors.join("\n"));
      process.exit(1);
    }

    remote = await remoteManifest(client, sources);
    result = reconcile(local, remote);
  }

  const remoteBytes = remote.reduce((sum, item) => sum + item.size, 0);
  console.log(`R2 after: ${remote.length.toLocaleString()} objects, ${remoteBytes.toLocaleString()} bytes.`);
  if (result.missing.length || result.mismatched.length || result.unexpected.length || remoteBytes !== localBytes) {
    console.error(`Verification failed: ${result.missing.length} missing, ${result.mismatched.length} mismatched, ${result.unexpected.length} unexpected.`);
    process.exit(1);
  }
  console.log("Verified: every R2 object matches the local key, byte size, and MD5 ETag.");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
