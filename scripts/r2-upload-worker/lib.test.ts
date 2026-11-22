// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { composeUploadReceipt, indexLogRows, verifiedLogRow } from "../lib/upload-receipt.mjs";
import { assertManifestKeys, bankPaths, buildAllowlist, classifyPutResult, putWithRetry, runSelftest } from "./lib.mjs";

const asset = { objectKey: "bank/a.webp", sha256: "a".repeat(64), size: 10, contentType: "image/webp", sourcePath: "/tmp/a.webp" };
const manifest = { bank: "bank", objectPrefix: "bank/", assets: [asset, { ...asset, objectKey: "bank/b.webp", sha256: "b".repeat(64), size: 20 }] };
const worker = { url: "https://w.workers.dev", token: "f".repeat(64) };
const noSleep = async () => {};
const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

describe("upload helpers", () => {
  it("defaults to the repo root and validates the bank name", () => {
    const p = bankPaths({ bank: "a-level-x-1" });
    expect(p.manifest).toMatch(/data\/storage\/a-level-x-1\.manifest\.json$/);
    expect(p.log).toMatch(/docs\/a-level-x-1-r2-upload-log\.jsonl$/);
    expect(() => bankPaths({ bank: "../etc" })).toThrow();
    expect(() => bankPaths({ bank: undefined })).toThrow();
  });

  it("bundles only key, hash and size into the allowlist", () => {
    expect(buildAllowlist(manifest, "bank")).toEqual({ bank: "bank", assets: [
      { objectKey: "bank/a.webp", sha256: "a".repeat(64), size: 10 },
      { objectKey: "bank/b.webp", sha256: "b".repeat(64), size: 20 },
    ] });
    expect(() => buildAllowlist(manifest, "other")).toThrow("manifest bank mismatch");
  });

  it("rejects keys outside the prefix and non-webp types", () => {
    expect(() => assertManifestKeys(manifest)).not.toThrow();
    expect(() => assertManifestKeys({ ...manifest, assets: [{ ...asset, objectKey: "other/a.webp" }] })).toThrow("bad key or type");
    expect(() => assertManifestKeys({ ...manifest, assets: [{ ...asset, contentType: "image/png" }] })).toThrow("bad key or type");
  });

  it("accepts verified and exists only when stored hash and size equal the manifest", () => {
    expect(classifyPutResult({ status: "verified", sha256: asset.sha256, bytes: 10 }, asset)).toEqual({ existedBefore: false });
    expect(classifyPutResult({ status: "exists", sha256: asset.sha256, bytes: 10 }, asset)).toEqual({ existedBefore: true });
    expect(classifyPutResult({ status: "exists", sha256: "c".repeat(64), bytes: 10 }, asset)).toBeNull();
    expect(classifyPutResult({ status: "exists", sha256: asset.sha256, bytes: 11 }, asset)).toBeNull();
    expect(classifyPutResult({ status: "readback_mismatch", sha256: asset.sha256, bytes: 10 }, asset)).toBeNull();
    expect(classifyPutResult({ status: "refused" }, asset)).toBeNull();
  });
});

describe("putWithRetry and selftest", () => {
  it("sends the token and key, and returns the Worker's answer", async () => {
    const fetchImpl = vi.fn(async () => reply(200, { status: "verified", sha256: asset.sha256, bytes: 10 }));
    const result = await putWithRetry(worker, asset, new Uint8Array(10), { fetchImpl: fetchImpl as never, sleep: noSleep });
    expect(result.status).toBe("verified");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://w.workers.dev/put");
    expect(init.headers).toMatchObject({ "x-upload-token": worker.token, "x-object-key": asset.objectKey });
  });

  it("retries 5xx and 429, then gives up with network_failure", async () => {
    const flaky = vi.fn().mockResolvedValueOnce(reply(503)).mockResolvedValueOnce(reply(429)).mockResolvedValueOnce(reply(200, { status: "verified" }));
    expect((await putWithRetry(worker, asset, new Uint8Array(1), { fetchImpl: flaky as never, sleep: noSleep })).status).toBe("verified");
    const down = vi.fn(async () => reply(500));
    expect((await putWithRetry(worker, asset, new Uint8Array(1), { fetchImpl: down as never, sleep: noSleep, maxRetries: 2 })).status).toBe("network_failure");
    expect(down).toHaveBeenCalledTimes(3);
  });

  it("does not retry an unauthorized token and reports the HTTP status", async () => {
    const forbidden = vi.fn(async () => reply(403));
    expect(await putWithRetry(worker, asset, new Uint8Array(1), { fetchImpl: forbidden as never, sleep: noSleep })).toEqual({ status: "http_403" });
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  it("selftest throws unless create-only is proven", async () => {
    expect(await runSelftest(worker, { fetchImpl: (async () => reply(200, { ok: true })) as never, sleep: noSleep })).toEqual({ ok: true });
    await expect(runSelftest(worker, { fetchImpl: (async () => reply(200, { ok: false })) as never, sleep: noSleep })).rejects.toThrow("self-test failed");
    await expect(runSelftest(worker, { fetchImpl: (async () => reply(404)) as never, sleep: noSleep, attempts: 2 })).rejects.toThrow("unreachable");
  });
});

describe("log rows and receipt", () => {
  const byKey = new Map(manifest.assets.map((a) => [a.objectKey, a]));

  it("log rows have the shape --finalize reads", () => {
    expect(verifiedLogRow({ bank: "bank", asset, existedBefore: false, at: "2026-11-21T00:00:00.000Z", via: "ppp-asset-upload" })).toEqual({
      bank: "bank", key: "bank/a.webp", sha256: asset.sha256, bytes: 10, status: "verified", existedBefore: false, at: "2026-11-21T00:00:00.000Z", via: "ppp-asset-upload",
    });
    expect(verifiedLogRow({ bank: "bank", asset, existedBefore: true, at: "t" })).not.toHaveProperty("via");
  });

  it("resuming rejects log lines that do not match the manifest", () => {
    const row = verifiedLogRow({ bank: "bank", asset, existedBefore: false });
    expect(indexLogRows([row], byKey).size).toBe(1);
    expect(() => indexLogRows([{ ...row, sha256: "c".repeat(64) }], byKey)).toThrow("does not match manifest");
    expect(() => indexLogRows([{ ...row, key: "bank/zzz.webp" }], byKey)).toThrow("does not match manifest");
    expect(() => indexLogRows([{ ...row, status: "failed" }], byKey)).toThrow("does not match manifest");
  });

  it("resuming accepts only verified originals superseded by a .v2.webp manifest key", () => {
    const v2 = { objectKey: "bank/q1.v2.webp", sha256: "f".repeat(64), size: 5 };
    const keys = new Map([[v2.objectKey, v2]]);
    const original = verifiedLogRow({ bank: "bank", asset: { objectKey: "bank/q1.webp", sha256: "9".repeat(64), size: 4 }, existedBefore: false });
    const superseded = new Set<string>();
    expect(indexLogRows([original], keys, superseded).size).toBe(0);
    expect([...superseded]).toEqual(["bank/q1.webp"]);
    expect(() => indexLogRows([original], keys)).toThrow("does not match manifest"); // opt-in only
    expect(() => indexLogRows([{ ...original, status: "failed" }], keys, new Set())).toThrow("does not match manifest");
    expect(() => indexLogRows([{ ...original, key: "bank/q2.webp" }], keys, new Set())).toThrow("does not match manifest");
    expect(() => indexLogRows([{ ...original, key: "bank/q1.v2.webp" }], keys, new Set())).toThrow("does not match manifest"); // a v2 row must match its own hash
  });

  it("resumes on the real 9709 log: every current row validates and each crop-revision original is superseded", () => {
    const root = path.resolve(import.meta.dirname, "../..");
    const real = JSON.parse(readFileSync(path.join(root, "data/storage/a-level-maths-9709.manifest.json"), "utf8"));
    const rows = readFileSync(path.join(root, "docs/a-level-maths-9709-r2-upload-log.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
    const keys = new Map<string, { objectKey: string; sha256: string; size: number }>(real.assets.map((a: { objectKey: string; sha256: string; size: number }) => [a.objectKey, a]));
    const superseded = new Set<string>();
    const done = indexLogRows(rows, keys, superseded);
    // One superseded original per .v2.webp key whose original was uploaded (23 from 2026-11-15, more with later revisions).
    const logged = new Set(rows.map((row) => row.key));
    const revised = real.assets.filter((a: { objectKey: string }) => a.objectKey.endsWith(".v2.webp") && logged.has(`${a.objectKey.slice(0, -8)}.webp`));
    expect(done.size).toBe(real.assets.length);
    expect(superseded.size).toBe(revised.length);
    expect(superseded.size).toBeGreaterThanOrEqual(23);
    expect([...superseded].every((key) => keys.has(`${key.slice(0, -5)}.v2.webp`))).toBe(true);
    const receipt = composeUploadReceipt({ bank: "a-level-maths-9709", manifest: real, rows, method: "m", logPath: "docs/a-level-maths-9709-r2-upload-log.jsonl", logSha256: "d".repeat(64), manifestSha256: () => "e".repeat(64), supersededKeys: [...superseded] });
    expect(receipt.completed).toHaveLength(real.assets.length);
    expect(receipt.readbackProvenance.supersededKeys).toHaveLength(revised.length);
  });

  it("composes an igcse-upload-receipt-v1 receipt and refuses an incomplete log", () => {
    const rows = manifest.assets.map((a, i) => verifiedLogRow({ bank: "bank", asset: a, existedBefore: i === 1 }));
    const receipt = composeUploadReceipt({ bank: "bank", manifest, rows, method: "m", logPath: "docs/bank-r2-upload-log.jsonl", logSha256: "d".repeat(64), manifestSha256: () => "e".repeat(64) });
    expect(receipt).toEqual({
      schemaVersion: "igcse-upload-receipt-v1", bank: "bank", storageState: "verified_readback", assetManifestSha256: "e".repeat(64),
      completed: ["bank/a.webp", "bank/b.webp"], failed: [],
      readbackProvenance: { method: "m", log: "docs/bank-r2-upload-log.jsonl", logSha256: "d".repeat(64), existedBefore: 1, supersededKeys: [] },
    });
    expect(() => composeUploadReceipt({ bank: "bank", manifest, rows: rows.slice(0, 1), method: "m", logPath: "l", logSha256: "d", manifestSha256: () => "e" })).toThrow("log does not cover the manifest");
  });
});
