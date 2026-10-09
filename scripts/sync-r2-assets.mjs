#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Source repositories are siblings of the main checkout. Resolve through Git's common directory so the
// script finds them from a linked worktree (for example .worktrees/<name>) as well.
function workspaceRoot() {
  try {
    const commonDir = execFileSync("git", ["-C", REPO_ROOT, "rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return resolve(dirname(commonDir), "..");
  } catch {
    return resolve(REPO_ROOT, "..");
  }
}

const WORKSPACE_ROOT = workspaceRoot();
const BUCKET = process.env.R2_BUCKET_NAME ?? "pastpaperprep-assets";
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_SYNC_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SYNC_SECRET_ACCESS_KEY;
const CONCURRENCY = Number(process.env.UPLOAD_CONCURRENCY ?? 16);
const VERIFY_ONLY = process.argv.includes("--verify-only");
const IGCSE_SOURCE_ROOT = process.env.PASTPAPERPREP_IGCSE_0580_SOURCE_ROOT
  ? resolve(process.env.PASTPAPERPREP_IGCSE_0580_SOURCE_ROOT)
  : join(WORKSPACE_ROOT, "igcse-0580-topic-practice/site");

// IB science 2016–2019 extension rows reference their images by public URL. The URL path is the R2 key
// (see storageObjectPath in src/lib/assets.ts); the committed upload manifest maps each key to its source
// file, which lives outside site/ (site-extension/, data-extension/site/, site/*-extension/).
function ibScience(bank, repository) {
  return {
    bank,
    root: join(WORKSPACE_ROOT, repository, "site"),
    raw: join(REPO_ROOT, `src/data/raw/${bank}.json`),
    imageFields: ["questionImages"],
    officialMarkschemeImages: true,
    publicRoot: `https://saksham106.github.io/${repository}/`,
    extension: {
      repositoryRoot: join(WORKSPACE_ROOT, repository),
      manifest: join(REPO_ROOT, `docs/ib-science-storage/${bank}.pending-upload-manifest.json`),
    },
  };
}

const SOURCES = [
  { bank: "igcse", root: IGCSE_SOURCE_ROOT, raw: join(REPO_ROOT, "src/data/raw/igcse.json"), imageFields: ["questionImages", "markschemeImages"] },
  { bank: "igcse-additional", root: join(WORKSPACE_ROOT, "igcse-additional-mathematics-0606-topic-practice/site"), raw: join(REPO_ROOT, "src/data/raw/igcse-additional.json"), imageFields: ["questionImages", "markschemeImages"] },
  { bank: "ib-hl", root: join(WORKSPACE_ROOT, "ib-maths-aa-hl-topic-practice/site"), raw: join(REPO_ROOT, "src/data/raw/ib-hl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-sl", root: join(WORKSPACE_ROOT, "ib-maths-aa-topic-finder-audit/site"), raw: join(REPO_ROOT, "src/data/raw/ib-sl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-ai-hl", root: join(WORKSPACE_ROOT, "ib-maths-ai-hl-topic-practice-full-audit-final/site"), raw: join(REPO_ROOT, "src/data/raw/ib-ai-hl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  { bank: "ib-ai-sl", root: join(WORKSPACE_ROOT, "ib-maths-ai-sl-topic-practice-audit-fix-ai-sl/site"), raw: join(REPO_ROOT, "src/data/raw/ib-ai-sl.json"), imageFields: ["questionImages"], officialMarkschemeImages: true },
  ibScience("ib-chemistry-hl", "ib-chemistry-topic-practice"),
  ibScience("ib-chemistry-sl", "ib-chemistry-topic-practice"),
  ibScience("ib-physics-hl", "ib-physics-topic-practice"),
  ibScience("ib-physics-sl", "ib-physics-topic-practice"),
  ibScience("ib-biology-hl", "ib-biology-topic-practice"),
  ibScience("ib-biology-sl", "ib-biology-topic-practice"),
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

function assertSafeRelativePath(source, reference, relativePath = reference) {
  if (typeof relativePath !== "string" || !relativePath.endsWith(".webp") || relativePath.startsWith("/") || relativePath.includes("\\")) {
    throw new Error(`Invalid referenced ${source.bank} asset: ${String(reference)}`);
  }
  const segments = relativePath.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Referenced ${source.bank} asset escapes source root: ${reference}`);
  }
}

function resolveInside(source, reference, rootPath, relativePath) {
  const absolute = resolve(rootPath, relativePath);
  if (absolute !== rootPath && !absolute.startsWith(`${rootPath}${sep}`)) {
    throw new Error(`Referenced ${source.bank} asset escapes source root: ${reference}`);
  }
  return absolute;
}

function isAbsoluteUrl(reference) {
  return typeof reference === "string" && /^[a-z][a-z0-9+.-]*:/i.test(reference);
}

/** Mirrors storageObjectPath in src/lib/assets.ts: the R2 key is `${bank}/${path below the public root}`. */
export function publicUrlRelativeKey(source, reference) {
  if (!source.publicRoot) throw new Error(`Referenced ${source.bank} asset is a URL but the bank has no public root: ${reference}`);
  const expectedRoot = new URL(source.publicRoot);
  let url;
  try {
    url = new URL(reference);
  } catch {
    throw new Error(`Invalid referenced ${source.bank} asset: ${String(reference)}`);
  }
  if (url.protocol !== "https:" || url.origin !== expectedRoot.origin || url.search || url.hash) {
    throw new Error(`Referenced ${source.bank} asset host is not allowed: ${reference}`);
  }
  if (!url.pathname.startsWith(expectedRoot.pathname)) {
    throw new Error(`Referenced ${source.bank} asset does not belong to ${source.publicRoot}: ${reference}`);
  }
  let relativePath;
  try {
    relativePath = decodeURIComponent(url.pathname.slice(expectedRoot.pathname.length));
  } catch {
    throw new Error(`Invalid referenced ${source.bank} asset: ${reference}`);
  }
  assertSafeRelativePath(source, reference, relativePath);
  return relativePath;
}

async function loadExtensionManifest(source) {
  const manifest = JSON.parse(await readFile(source.extension.manifest, "utf8"));
  if (
    manifest?.schemaVersion !== "ib-science-pending-upload-manifest.v1" ||
    manifest.bank !== source.bank ||
    manifest.prefix !== `${source.bank}/` ||
    !Array.isArray(manifest.assets)
  ) {
    throw new Error(`Invalid ${source.bank} extension upload manifest`);
  }
  const repositoryRoot = await realpath(source.extension.repositoryRoot);
  const byKey = new Map();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.objectKey !== "string" || typeof asset.sourcePath !== "string" || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
      throw new Error(`Invalid ${source.bank} extension manifest asset`);
    }
    assertSafeRelativePath(source, asset.objectKey);
    assertSafeRelativePath(source, asset.sourcePath);
    if (byKey.has(asset.objectKey)) throw new Error(`Duplicate ${source.bank} extension manifest key: ${asset.objectKey}`);
    byKey.set(asset.objectKey, { ...asset, path: resolveInside(source, asset.sourcePath, repositoryRoot, asset.sourcePath) });
  }
  return { repositoryRoot, byKey };
}

async function existingPathInside(source, reference, rootPath, absolute) {
  let actualPath;
  try {
    actualPath = await realpath(absolute);
  } catch {
    throw new Error(`Missing referenced ${source.bank} asset: ${reference}`);
  }
  if (actualPath !== rootPath && !actualPath.startsWith(`${rootPath}${sep}`)) {
    throw new Error(`Referenced ${source.bank} asset escapes source root: ${reference}`);
  }
  return actualPath;
}

export async function referencedWebpFiles(source) {
  if (!source.raw) throw new Error(`Missing runtime JSON path for ${source.bank}`);
  const raw = JSON.parse(await readFile(source.raw, "utf8"));
  if (!raw || !Array.isArray(raw.questions)) throw new Error(`Invalid runtime JSON questions for ${source.bank}`);
  const rootPath = await realpath(source.root);
  const extension = source.extension ? await loadExtensionManifest(source) : null;
  const files = new Map();
  function add(relative, file, reference) {
    const existing = files.get(relative);
    if (existing && existing.path !== file.path) {
      throw new Error(`Referenced ${source.bank} key ${relative} resolves to two source files: ${reference}`);
    }
    files.set(relative, existing ?? { ...file, relative });
  }
  for (const question of raw.questions) {
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      throw new Error(`Invalid runtime question in ${source.bank}`);
    }
    for (const reference of referenceValues(question, source)) {
      if (isAbsoluteUrl(reference) && source.publicRoot) {
        const relative = publicUrlRelativeKey(source, reference);
        const asset = extension?.byKey.get(relative);
        if (!asset) throw new Error(`Referenced ${source.bank} asset has no upload manifest entry: ${reference}`);
        const path = await existingPathInside(source, reference, extension.repositoryRoot, asset.path);
        add(relative, { path, sha256: asset.sha256 }, reference);
        continue;
      }
      assertSafeRelativePath(source, reference);
      const path = await existingPathInside(source, reference, rootPath, resolveInside(source, reference, rootPath, reference));
      add(reference, { path }, reference);
    }
  }
  return [...files.values()].sort((a, b) => a.relative.localeCompare(b.relative));
}

async function digests(path) {
  const md5 = createHash("md5");
  const sha256 = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    md5.update(chunk);
    sha256.update(chunk);
  }
  return { md5: md5.digest("hex"), sha256: sha256.digest("hex") };
}

export async function localManifest(sources = SOURCES, concurrency = CONCURRENCY) {
  const groups = await Promise.all(sources.map(async (source) => {
    const files = await referencedWebpFiles(source);
    return files.map((file) => ({
      key: `${source.bank}/${file.relative}`,
      path: file.path,
      expectedSha256: file.sha256,
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
      const entry = entries[index];
      const metadata = await stat(entry.path);
      const digest = await digests(entry.path);
      if (entry.expectedSha256 && digest.sha256 !== entry.expectedSha256) {
        throw new Error(`Source bytes for ${entry.key} do not match the upload manifest sha256.`);
      }
      entry.size = metadata.size;
      entry.etag = digest.md5;
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
