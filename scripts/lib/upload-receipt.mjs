// Log rows and the `igcse-upload-receipt-v1` receipt for private R2 uploads, shared by
// scripts/r2-upload-worker/upload.mjs and scripts/upload-computer-science-wrangler.mjs so that
// `generate-igcse-release.mjs --finalize <bank>` accepts either one.

/** One verified object, appended to docs/<bank>-r2-upload-log.jsonl. No secrets. */
export function verifiedLogRow({ bank, asset, existedBefore, at = new Date().toISOString(), via = "" }) {
  return { bank, key: asset.objectKey, sha256: asset.sha256, bytes: asset.size, status: "verified", existedBefore, at, ...(via ? { via } : {}) };
}

/**
 * Rows must match the manifest exactly (hash, size, verified); returns key -> row. Unknown keys fail closed, except a
 * crop revision's superseded original: a verified `<stem>.webp` whose `<stem>.v2.webp` replacement is in the manifest
 * (the original stays in the bucket, unreferenced; 9709 has 23 from 2026-11-15). Those keys are collected into
 * `superseded` when it is given, so the receipt can list them; without it they still fail closed.
 * @param {Array<{ key: string, sha256: string, bytes: number, status: string }>} rows
 * @param {Map<string, { objectKey: string, sha256: string, size: number }>} byKey
 * @param {Set<string> | null} [superseded]
 */
export function indexLogRows(rows, byKey, superseded = null) {
  const done = new Map();
  for (const row of rows) {
    const asset = byKey.get(row.key);
    if (!asset && superseded && row.status === "verified" && supersedingKey(row.key, byKey)) { superseded.add(row.key); continue; }
    if (!asset || row.sha256 !== asset.sha256 || row.bytes !== asset.size || row.status !== "verified") throw new Error(`log line does not match manifest: ${row.key}`);
    done.set(row.key, row);
  }
  return done;
}

/** The `.v2.webp` manifest key that replaces `<stem>.webp`, or undefined. */
export function supersedingKey(key, byKey) {
  if (!key.endsWith(".webp") || key.endsWith(".v2.webp")) return undefined;
  const replacement = `${key.slice(0, -5)}.v2.webp`;
  return byKey.has(replacement) ? replacement : undefined;
}

/**
 * The `verified_readback` receipt over a full manifest. Throws unless the log covers every manifest key.
 * `logPath` is the repo-relative path of the log, `logSha256` its hash; `manifestSha256` is igcse-release.mjs's.
 * `supersededKeys` lists crop-revision originals the log still holds (see indexLogRows).
 * @param {{ bank: string, manifest: { assets: Array<{ objectKey: string }> }, rows: Array<{ key: string, existedBefore?: boolean }>,
 *   method: string, logPath: string, logSha256: string, manifestSha256: (manifest: any) => string, supersededKeys?: string[] }} options
 */
export function composeUploadReceipt({ bank, manifest, rows, method, logPath, logSha256, manifestSha256, supersededKeys = [] }) {
  const byKey = new Set(manifest.assets.map((asset) => asset.objectKey));
  const keys = [...new Set(rows.map((row) => row.key))].filter((key) => byKey.has(key)).sort();
  if (keys.length !== manifest.assets.length) throw new Error("log does not cover the manifest");
  return {
    schemaVersion: "igcse-upload-receipt-v1",
    bank,
    storageState: "verified_readback",
    assetManifestSha256: manifestSha256(manifest),
    completed: keys,
    failed: [],
    readbackProvenance: {
      method,
      log: logPath,
      logSha256,
      existedBefore: rows.filter((row) => row.existedBefore).length,
      supersededKeys: [...supersededKeys].sort(),
    },
  };
}
