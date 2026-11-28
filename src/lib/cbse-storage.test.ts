import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { manifestSha256, runtimeSha256 } from "../../scripts/igcse-release.mjs";

// Every finalized CBSE bank: the runtime is sealed to a complete, verified create-only read-back of exactly its upload
// manifest. A bank not finalized yet (no receipt) is skipped.
const ROOT = process.cwd();
const BANKS = ["cbse-12-chemistry", "cbse-10-science", "cbse-12-physics", "cbse-12-biology", "cbse-10-maths", "cbse-12-maths"];
const read = (relative: string) => readFileSync(join(ROOT, relative), "utf8");
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describe.each(BANKS.filter((bank) => existsSync(join(ROOT, "data/storage", `${bank}.receipt.json`))))("%s storage", (bank) => {
  const runtime = JSON.parse(read(`src/data/production/${bank}.json`)) as { assetVerification: string; questions: { questionImages: string[]; markschemeImages: string[] }[]; runtimeArtifact: Record<string, string> };
  const manifest = JSON.parse(read(`data/storage/${bank}.manifest.json`)) as { objectPrefix: string; assets: { objectKey: string; sha256: string; size: number }[] };
  const receiptText = read(`data/storage/${bank}.receipt.json`);
  const receipt = JSON.parse(receiptText) as { bank: string; storageState: string; failed: unknown[]; completed: string[]; assetManifestSha256: string; readbackProvenance: { log: string; logSha256: string; existedBefore: number } };

  it("is finalized against a complete verified read-back of exactly the manifest's crops", () => {
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(receipt).toMatchObject({ bank, storageState: "verified_readback", failed: [], assetManifestSha256: manifestSha256(manifest) });
    expect([...receipt.completed].sort()).toEqual(manifest.assets.map((asset) => asset.objectKey).sort());
    const refs = new Set(runtime.questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages]));
    expect(manifest.assets.map((asset) => asset.objectKey.slice(manifest.objectPrefix.length)).sort()).toEqual([...refs].sort());
    expect(runtime.runtimeArtifact).toMatchObject({ assetVerification: "verified_readback", assetManifestSha256: manifestSha256(manifest), storageReceiptSha256: sha256(receiptText) });
    expect(runtimeSha256(runtime)).toBe(runtime.runtimeArtifact.runtimeSha256);
  });

  it("has a sealed upload log: every object verified, none pre-existing, matching the manifest", () => {
    const logText = read(receipt.readbackProvenance.log);
    expect(sha256(logText)).toBe(receipt.readbackProvenance.logSha256);
    expect(receipt.readbackProvenance.existedBefore).toBe(0);
    const log = logText.split("\n").filter(Boolean).map((line) => JSON.parse(line) as { key: string; sha256: string; bytes: number; status: string; existedBefore: boolean });
    const byKey = new Map(manifest.assets.map((asset) => [asset.objectKey, asset]));
    expect(log).toHaveLength(manifest.assets.length);
    expect(new Set(log.map((row) => row.key)).size).toBe(manifest.assets.length);
    for (const row of log) expect(row.status === "verified" && !row.existedBefore && byKey.get(row.key)?.sha256 === row.sha256 && byKey.get(row.key)?.size === row.bytes, row.key).toBe(true);
  });
});
