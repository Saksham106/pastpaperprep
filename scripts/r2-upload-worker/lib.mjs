// Pure helpers for scripts/r2-upload-worker/upload.mjs, kept apart so tests can import them without
// running the CLI. Nothing here touches Cloudflare unless a caller passes it a real fetch.
import { createHash } from "node:crypto";
import path from "node:path";
import { REPO_ROOT } from "../lib/worker-tools.mjs";

export const WORKER_NAME = "ppp-asset-upload";
export const BUCKET = "pastpaperprep-assets";
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Where a bank's manifest, receipt and log live in a checkout. `repo` defaults to this repository's root. */
export function bankPaths({ repo = REPO_ROOT, bank }) {
  if (!bank || !/^[a-z0-9-]+$/.test(bank)) throw new Error("--bank required (lowercase letters, digits and dashes)");
  const root = path.resolve(repo);
  return {
    repo: root,
    bank,
    manifest: path.join(root, "data/storage", `${bank}.manifest.json`),
    receipt: path.join(root, "data/storage", `${bank}.receipt.json`),
    log: path.join(root, "docs", `${bank}-r2-upload-log.jsonl`),
  };
}

/** The only fields the Worker's bundled allowlist carries: key, hash and size. */
export function buildAllowlist(manifest, bank) {
  if (manifest.bank !== bank) throw new Error("manifest bank mismatch");
  return { bank, assets: manifest.assets.map(({ objectKey, sha256: digest, size }) => ({ objectKey, sha256: digest, size })) };
}

/** Every asset must sit under the bank's object prefix and be a WebP. */
export function assertManifestKeys(manifest) {
  for (const asset of manifest.assets) {
    if (!asset.objectKey.startsWith(manifest.objectPrefix) || asset.contentType !== "image/webp") throw new Error(`bad key or type: ${asset.objectKey}`);
  }
}

/**
 * One create-only put through the Worker, retrying 429/5xx and network errors with backoff.
 * Returns the Worker's JSON answer, or { status: "http_<n>" } / { status: "network_failure" }.
 */
export async function putWithRetry(worker, asset, bytes, { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), maxRetries = 5 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetchImpl(`${worker.url}/put`, {
        method: "POST", body: bytes,
        headers: { "x-upload-token": worker.token, "x-object-key": asset.objectKey, "content-type": "application/octet-stream" },
      });
      if (response.status >= 500 || response.status === 429) throw new Error(`HTTP ${response.status}`);
      if (!response.ok) return { status: `http_${response.status}` };
      const result = await response.json();
      if (result.status === "error") throw new Error("worker error");
      return result;
    } catch (error) {
      if (attempt >= maxRetries) return { status: "network_failure", detail: String(error.message) };
      await sleep(1000 * 2 ** attempt);
    }
  }
}

/** Runs /selftest; throws unless the Worker proves a second create-only put is refused. Retries while a fresh secret propagates. */
export async function runSelftest(worker, { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), attempts = 10 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetchImpl(`${worker.url}/selftest`, { method: "POST", headers: { "x-upload-token": worker.token } }).catch(() => null);
    const result = response?.ok ? await response.json().catch(() => null) : null;
    if (result) {
      if (result.ok !== true) throw new Error(`self-test failed: ${JSON.stringify(result)}`);
      return result;
    }
    await sleep(3000);
  }
  throw new Error("self-test unreachable");
}

/**
 * Turns one Worker answer into a log row, or null when it is not an acceptable outcome.
 * `verified` and `exists` are both accepted only when the stored hash and size equal the manifest's, so a
 * harmless re-run (same bytes) is told apart from a conflict (different bytes at that key).
 */
export function classifyPutResult(result, asset) {
  const same = result.sha256 === asset.sha256 && result.bytes === asset.size;
  if (result.status === "verified" && same) return { existedBefore: false };
  if (result.status === "exists" && same) return { existedBefore: true };
  return null;
}

export function describeFailure(asset, result) {
  return `${asset.objectKey}: ${result.status}${result.sha256 ? ` (stored ${result.sha256.slice(0, 12)})` : ""}`;
}
