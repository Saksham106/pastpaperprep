#!/usr/bin/env node
// Uploads a bank's crops to the private R2 bucket through a temporary Worker (see worker.mjs).
// Writes the same log rows and `igcse-upload-receipt-v1` receipt as the retired wrangler uploader, so
// `generate-igcse-release.mjs --finalize <bank>` works unchanged.
//
// Every real run (deploy, upload, delete) needs explicit owner approval, asked in the session that runs it.
// Nothing here runs unless you invoke a command; tests use in-memory fakes only.
//
//   node scripts/r2-upload-worker/upload.mjs deploy   --bank <bank> --work <private dir> [--repo <checkout>]
//   node scripts/r2-upload-worker/upload.mjs selftest --work <dir>
//   node scripts/r2-upload-worker/upload.mjs upload   --bank <bank> --work <dir> [--repo <checkout>] [--concurrency 8]
//   node scripts/r2-upload-worker/upload.mjs delete   --work <dir>
//
// `--repo` defaults to this repository. `--work` must be outside the repo; the token lives only in
// <work>/upload-worker.json (mode 0600) and the Worker's secret, and is never printed.
// WRANGLER=<binary> overrides `npx -y wrangler@4`.
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { composeUploadReceipt, indexLogRows, verifiedLogRow } from "../lib/upload-receipt.mjs";
import { runWrangler } from "../lib/wrangler-cli.mjs";
import { argValue, assertOutsideRepo, ensurePrivateDir, readWorkerConfig, waitForWorkerAuth, writePrivateJson } from "../lib/worker-tools.mjs";
import { BUCKET, WORKER_NAME, assertManifestKeys, bankPaths, buildAllowlist, classifyPutResult, describeFailure, putWithRetry, runSelftest, sha256 } from "./lib.mjs";

const here = import.meta.dirname;
const [command, ...rest] = process.argv.slice(2);
const arg = (name, fallback) => argValue(rest, name, fallback);

function workFile() {
  const work = path.resolve(arg("work") ?? (() => { throw new Error("--work required"); })());
  assertOutsideRepo(work);
  ensurePrivateDir(work);
  return path.join(work, "upload-worker.json");
}

function paths() {
  return bankPaths({ repo: arg("repo"), bank: arg("bank") });
}

async function deploy() {
  const { bank, manifest: manifestPath } = paths();
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const file = workFile();
  const dir = mkdtempSync(path.join(tmpdir(), "ppp-upload-worker-"));
  chmodSync(dir, 0o700);
  try {
    copyFileSync(path.join(here, "worker.mjs"), path.join(dir, "worker.mjs"));
    writeFileSync(path.join(dir, "allowlist.json"), JSON.stringify(buildAllowlist(manifest, bank)));
    writeFileSync(path.join(dir, "wrangler.jsonc"), JSON.stringify({
      name: WORKER_NAME, main: "worker.mjs", compatibility_date: "2026-11-01", workers_dev: true,
      r2_buckets: [{ binding: "ASSETS", bucket_name: BUCKET }],
    }, null, 2));
    const out = await runWrangler(["deploy"], { cwd: dir });
    const url = out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0];
    if (!url) throw new Error("deploy output had no workers.dev URL");
    const token = randomBytes(32).toString("hex");
    await runWrangler(["secret", "put", "UPLOAD_TOKEN", "--name", WORKER_NAME], { cwd: dir, input: token });
    writePrivateJson(file, { url, token, bank });
    console.log(JSON.stringify({ deployed: WORKER_NAME, url, allowed: manifest.assets.length }));
    await waitForWorkerAuth(url, "/selftest");
    console.log(JSON.stringify({ live: true }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function upload() {
  const p = paths();
  const worker = readWorkerConfig(workFile());
  if (worker.bank !== p.bank) throw new Error("deployed Worker is for another bank");
  const manifest = JSON.parse(readFileSync(p.manifest, "utf8"));
  const { manifestSha256 } = await import(pathToFileURL(path.join(p.repo, "scripts/igcse-release.mjs")).href);
  assertManifestKeys(manifest);
  const byKey = new Map(manifest.assets.map((asset) => [asset.objectKey, asset]));
  const logRows = () => readFileSync(p.log, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const done = existsSync(p.log) ? indexLogRows(logRows(), byKey) : new Map();
  const pending = manifest.assets.filter((asset) => !done.has(asset.objectKey));
  console.log(JSON.stringify({ total: manifest.assets.length, alreadyVerified: done.size, pending: pending.length }));
  await waitForWorkerAuth(worker.url, "/selftest");
  console.log(JSON.stringify({ selftest: await runSelftest(worker) }));

  const concurrency = Number(arg("concurrency", "8"));
  let index = 0, verified = done.size, existed = 0, failure = null;
  const started = Date.now();
  const lane = async () => {
    while (!failure && index < pending.length) {
      const asset = pending[index++];
      const bytes = readFileSync(asset.sourcePath);
      if (bytes.length !== asset.size || sha256(bytes) !== asset.sha256) { failure = new Error(`local file drifted: ${asset.sourcePath}`); return; }
      const result = await putWithRetry(worker, asset, bytes);
      const outcome = classifyPutResult(result, asset);
      if (!outcome) { failure = new Error(describeFailure(asset, result)); return; }
      if (outcome.existedBefore) existed += 1;
      appendFileSync(p.log, `${JSON.stringify(verifiedLogRow({ bank: p.bank, asset, existedBefore: outcome.existedBefore, via: WORKER_NAME }))}\n`);
      verified += 1;
      if (verified % 500 === 0) console.log(JSON.stringify({ verified, total: manifest.assets.length, seconds: Math.round((Date.now() - started) / 1000) }));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, lane));
  if (failure) throw failure;

  const receipt = composeUploadReceipt({
    bank: p.bank, manifest, rows: logRows(), manifestSha256,
    method: `worker-binding create-only put (R2 sha256-checked) + get re-hash (${WORKER_NAME})`,
    logPath: path.relative(p.repo, p.log), logSha256: sha256(readFileSync(p.log)),
  });
  writeFileSync(p.receipt, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ verified: receipt.completed.length, existedBefore: existed, seconds: Math.round((Date.now() - started) / 1000), receipt: path.relative(p.repo, p.receipt) }));
}

async function remove() {
  const file = workFile();
  const out = await runWrangler(["delete", "--name", WORKER_NAME, "--force"], { cwd: tmpdir() });
  rmSync(file, { force: true });
  console.log(JSON.stringify({ deleted: WORKER_NAME, output: out.trim().split("\n").slice(-1)[0], next: "confirm the workers.dev URL now answers 404" }));
}

const commands = {
  deploy,
  selftest: async () => console.log(JSON.stringify(await runSelftest(readWorkerConfig(workFile())))),
  upload,
  delete: remove,
};
if (!commands[command]) { console.error("usage: deploy | selftest | upload | delete"); process.exit(2); }
await commands[command]();
