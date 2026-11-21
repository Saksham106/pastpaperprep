// Log rows and the `igcse-upload-receipt-v1` receipt for private R2 uploads, shared by
// scripts/r2-upload-worker/upload.mjs and scripts/upload-computer-science-wrangler.mjs so that
// `generate-igcse-release.mjs --finalize <bank>` accepts either one.

/** One verified object, appended to docs/<bank>-r2-upload-log.jsonl. No secrets. */
export function verifiedLogRow({ bank, asset, existedBefore, at = new Date().toISOString(), via = "" }) {
  return { bank, key: asset.objectKey, sha256: asset.sha256, bytes: asset.size, status: "verified", existedBefore, at, ...(via ? { via } : {}) };
}

/** Rows must match the manifest exactly (hash, size, verified); returns key -> row. Unknown keys fail closed. */
export function indexLogRows(rows, byKey) {
  const done = new Map();
  for (const row of rows) {
    const asset = byKey.get(row.key);
    if (!asset || row.sha256 !== asset.sha256 || row.bytes !== asset.size || row.status !== "verified") throw new Error(`log line does not match manifest: ${row.key}`);
    done.set(row.key, row);
  }
  return done;
}

/**
 * The `verified_readback` receipt over a full manifest. Throws unless the log covers every manifest key.
 * `logPath` is the repo-relative path of the log, `logSha256` its hash; `manifestSha256` is igcse-release.mjs's.
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
