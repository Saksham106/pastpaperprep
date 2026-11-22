// Pure helpers for scripts/free-copy/free-copy.mts (tested without Cloudflare or the app's data).
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";

export const WORKER_NAME = "ppp-free-copy";
export const PRIVATE_BUCKET = "pastpaperprep-assets";
export const FREE_BUCKET = "pastpaperprep-free";
export const PUBLIC_BASE = "https://free.pastpaperprep.com/images/";
export const COPY_BATCH = 10; // matches MAX_BATCH in scripts/free-copy-worker/worker.mjs
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Env that makes the app load a held (pendingStorage) bank's candidate runtime. Same value for generate and list. */
export const HELD_BANK_ENV = "NODE_ENV=development PASTPAPERPREP_PREVIEW_PENDING_BANKS=true";

export function defaultOutDir(banks, home = homedir()) {
  return path.join(home, ".cache/ppp-upload-work/free-copy", banks.join("+"));
}

/** The exact command to run when a bank's asset manifest has not been generated for this environment. */
export function missingManifestMessage({ bank, held, fileName }) {
  const generate = `mkdir -p generated/asset-manifest generated/question-search && ${held ? `${HELD_BANK_ENV} ` : ""}npx tsx scripts/generate-asset-manifest.mts --bank ${bank}`;
  const note = held
    ? `${bank} is a held (pendingStorage) bank, so the full \`npm run generate:asset-manifest\` skips it. Run this from the repo root, then run this command again with the same env (${HELD_BANK_ENV}):`
    : `Run this from the repo root (with the production release flags from docs/free-public-assets.md set, as for publish-free-assets), then run this command again with the same env:`;
  return `Missing generated/asset-manifest/${fileName}. ${note}\n  ${generate}`;
}

/** Per-bank summary of a free-asset list, as printed by `list`. */
export function summariseAssets(bank, assets) {
  const byKind = {}, bySource = {};
  const years = new Set();
  for (const asset of assets) {
    byKind[asset.kind] = (byKind[asset.kind] ?? 0) + 1;
    bySource[asset.source] = (bySource[asset.source] ?? 0) + 1;
    years.add(asset.questionId.split("-")[1]);
  }
  return { bank, total: assets.length, byKind, bySource, years: [...years].sort(), questions: new Set(assets.map((asset) => asset.questionId)).size };
}

/**
 * The paths the Worker may copy: R2-sourced files only (the Worker reads the private R2 bucket; Supabase-sourced
 * previews need `scripts/publish-free-assets.mts` instead). Throws on an empty set.
 */
export function copyablePaths(bank, assets) {
  const r2 = assets.filter((asset) => asset.source === "r2");
  const skipped = assets.length - r2.length;
  if (!assets.length) throw new Error(`${bank}: no free files; check the bank's free years and that the manifest was generated for this environment`);
  if (!r2.length) throw new Error(`${bank}: all ${assets.length} free files are Supabase-sourced; this Worker copies R2 files only (use scripts/publish-free-assets.mts)`);
  return { paths: [...new Set(r2.map((asset) => asset.path))].sort(), skippedSupabase: skipped };
}

export function listDigest(paths) {
  return sha256(JSON.stringify(paths));
}

/** POST JSON to the copy Worker with backoff on 429/5xx and network errors. 4xx is fatal. */
export async function postWorker(worker, route, body, { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), maxRetries = 5 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetchImpl(`${worker.url}${route}`, {
        method: "POST", headers: { "x-copy-token": worker.token, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
      });
      if (response.status >= 500 || response.status === 429) throw new Error(`HTTP ${response.status}`);
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { fatal: true });
      return await response.json();
    } catch (error) {
      if (error.fatal || attempt >= maxRetries) throw error;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

/** Fetches one path from the public free bucket and compares it with the private object's hash and size. */
export async function verifyPublicPath(pathName, expected, { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), attempts = 4 } = {}) {
  let got = null, bytes = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetchImpl(`${PUBLIC_BASE}${pathName}`, { headers: { "cache-control": "no-cache" } }).catch(() => null);
    if (response?.ok) {
      const body = Buffer.from(await response.arrayBuffer());
      got = sha256(body);
      bytes = body.length;
      if (got === expected.sha256 && bytes === expected.bytes) return { path: pathName, ok: true, sha256: got, bytes };
    }
    if (attempt < attempts - 1) await sleep(1500);
  }
  return { path: pathName, ok: false, sha256: got, bytes };
}

/** Copy results that count as done (copied now, or already there with the same name; hashes are compared in verify). */
export const isDone = (row) => row.status === "copied" || row.status === "exists";
