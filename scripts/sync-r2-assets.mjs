#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
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

const SOURCES = [
  { bank: "igcse", root: join(WORKSPACE_ROOT, "igcse-0580-topic-practice/site") },
  { bank: "ib-hl", root: join(WORKSPACE_ROOT, "ib-maths-aa-hl-topic-practice/site") },
  { bank: "igcse-additional", root: join(WORKSPACE_ROOT, "igcse-additional-mathematics-0606-topic-practice-full-audit-final/site") },
  { bank: "ib-ai-hl", root: join(WORKSPACE_ROOT, "ib-maths-ai-hl-topic-practice-full-audit-final/site") },
  { bank: "ib-sl", root: join(WORKSPACE_ROOT, "ib-maths-aa-topic-finder-audit/site") },
  { bank: "ib-ai-sl", root: join(WORKSPACE_ROOT, "ib-maths-ai-sl-topic-practice-audit-fix-ai-sl/site") },
];

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error("R2_ACCOUNT_ID, R2_SYNC_ACCESS_KEY_ID, and R2_SYNC_SECRET_ACCESS_KEY are required.");
  process.exit(1);
}
if (!/^[a-f0-9]{32}$/i.test(ACCOUNT_ID) || BUCKET !== "pastpaperprep-assets") {
  console.error("Refusing to continue: invalid R2 account ID or bucket name.");
  process.exit(1);
}
if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1 || CONCURRENCY > 32) {
  console.error("UPLOAD_CONCURRENCY must be an integer from 1 to 32.");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
});

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile() && entry.name.endsWith(".webp")) files.push(path);
  }
  return files;
}

async function md5(path) {
  const hash = createHash("md5");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function localManifest() {
  const groups = await Promise.all(SOURCES.map(async (source) => {
    const files = await walk(source.root);
    return files.map((path) => ({
      key: `${source.bank}/${relative(source.root, path).split(sep).join("/")}`,
      path,
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
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, entries.length)) }, worker));
  return entries;
}

async function remoteManifest() {
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

const local = await localManifest();
const localBytes = local.reduce((sum, item) => sum + item.size, 0);
let remote = await remoteManifest();
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
          Body: createReadStream(item.path),
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

  remote = await remoteManifest();
  result = reconcile(local, remote);
}

const remoteBytes = remote.reduce((sum, item) => sum + item.size, 0);
console.log(`R2 after: ${remote.length.toLocaleString()} objects, ${remoteBytes.toLocaleString()} bytes.`);
if (result.missing.length || result.mismatched.length || result.unexpected.length || remoteBytes !== localBytes) {
  console.error(`Verification failed: ${result.missing.length} missing, ${result.mismatched.length} mismatched, ${result.unexpected.length} unexpected.`);
  process.exit(1);
}
console.log("Verified: every R2 object matches the local key, byte size, and MD5 ETag.");
