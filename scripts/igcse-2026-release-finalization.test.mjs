import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RELEASES_2026, readHistoricalStorage, reconstructCandidate, replayFinalize, verifyFinalizedBank, verifyReceiptComposition,
} from "./igcse-2026-release-finalization.mjs";
import { readRepairLog, readUploadLog, REPAIR_LOG_PATH, REPAIR_PLAN_PATH, UPLOAD_LOG_COUNTS, UPLOAD_LOG_PATH, withRepairUploadStatus, withUploadStatus } from "./r2-upload-2026-log.mjs";
import { manifestSha256, runtimeSha256 } from "./igcse-release.mjs";

const read = (file) => readFileSync(file, "utf8");
const banks = Object.keys(RELEASES_2026);
const files = (bank) => ({
  runtimeText: read(`src/data/production/${bank}.json`),
  manifestText: read(`data/storage/${bank}.manifest.json`),
  receiptText: read(`data/storage/${bank}.receipt.json`),
  planText: read(RELEASES_2026[bank].plan),
  logText: read(UPLOAD_LOG_PATH),
});
const composition = (bank, overrides = {}) => {
  const f = files(bank);
  const historical = readHistoricalStorage(bank);
  return { manifestText: f.manifestText, receiptText: f.receiptText, previousManifestText: historical.manifestText, previousReceiptText: historical.receiptText, logText: f.logText, planText: f.planText, ...overrides };
};

describe("2026 gap-paper upload log", () => {
  it("is the pinned create-only readback of exactly the four reviewed plans", () => {
    const { rows } = readUploadLog();
    expect(rows).toHaveLength(1588);
    expect(Object.fromEntries(Object.keys(UPLOAD_LOG_COUNTS).map((bank) => [bank, rows.filter((row) => row.bank === bank).length]))).toEqual(UPLOAD_LOG_COUNTS);
    expect(rows.every((row) => row.status === "verified" && row.existedBefore === false && /^[a-f0-9]{64}$/.test(row.sha256) && row.bytes > 0)).toBe(true);
    expect(Object.keys(rows[0]).sort()).toEqual(["at", "bank", "bytes", "existedBefore", "key", "sha256", "status"]);
    for (const plan of ["docs/igcse-0606-2026-march-r2-upload-plan.json", "docs/igcse-0580-2026-core-r2-upload-plan.json", ...banks.map((bank) => RELEASES_2026[bank].plan)]) {
      const committed = JSON.parse(read(plan));
      expect(committed).toMatchObject({ mode: "executed-upload-plan", status: "UPLOADED AND VERIFIED", upload: { overwritten: 0, readbackLog: UPLOAD_LOG_PATH } });
      expect(committed.upload.objects).toBe(committed.objects.length);
      const dryRun = { ...committed, mode: "dry-run-plan-only", status: "NOT UPLOADED" };
      delete dryRun.upload;
      expect(withUploadStatus(dryRun)).toEqual(committed);
      const missing = { ...dryRun, objects: [...dryRun.objects.slice(1), { ...dryRun.objects[0], sha256: "0".repeat(64) }] };
      expect(() => withUploadStatus(missing)).toThrow(/no matching verified readback/);
    }
  });
});

describe.each(banks)("%s 2026 release finalization", (bank) => {
  const config = RELEASES_2026[bank];

  it("is exactly finalizeRelease() over the pinned candidate and the committed manifest/receipt", async () => {
    const { runtimeText, manifestText, receiptText } = files(bank);
    const finalized = JSON.parse(runtimeText);
    const candidate = reconstructCandidate(bank, finalized);
    expect(candidate.runtimeArtifact.runtimeSha256).toBe(config.candidate.runtimeSha256);
    expect(runtimeSha256(candidate)).toBe(config.candidate.runtimeSha256);
    expect(await replayFinalize(bank, candidate, manifestText, receiptText)).toBe(runtimeText);
    expect(finalized.runtimeArtifact).toMatchObject({ runtimeSha256: config.finalized.runtimeSha256, finalizedContentSha256: config.finalized.finalizedContentSha256, assetManifestSha256: config.finalized.assetManifestSha256, storageReceiptSha256: config.finalized.storageReceiptSha256 });
    await expect(verifyFinalizedBank(bank)).resolves.toMatchObject({ previouslyVerified: config.previous.assets, added: config.added, total: config.previous.assets + config.added });
  }, 60_000);

  it("refuses a reconstruction that is not the committed candidate", () => {
    const finalized = JSON.parse(files(bank).runtimeText);
    const drift = structuredClone(finalized);
    drift.questions[0].summary = `${drift.questions[0].summary ?? ""} drift`;
    expect(() => reconstructCandidate(bank, drift)).toThrow(/pinned candidate/);
    const pending = structuredClone(finalized);
    pending.questions[pending.questions.length - 1].publicationStatus = "authorized_production_candidate";
    expect(() => reconstructCandidate(bank, pending)).toThrow(/non-production row/);
  });

  it("finalizeRelease() rejects a receipt missing any one key, even when padded to the same length", async () => {
    const { runtimeText, manifestText, receiptText } = files(bank);
    const candidate = reconstructCandidate(bank, JSON.parse(runtimeText));
    const receipt = JSON.parse(receiptText);
    const manifest = JSON.parse(manifestText);
    const historicalKeys = new Set(JSON.parse(readHistoricalStorage(bank).manifestText).assets.map((asset) => asset.objectKey));
    const oldKey = receipt.completed.find((key) => historicalKeys.has(key));
    const newKey = receipt.completed.find((key) => !historicalKeys.has(key));
    for (const key of [oldKey, newKey, receipt.completed.at(-1)]) {
      const shorter = { ...receipt, completed: receipt.completed.filter((item) => item !== key) };
      await expect(replayFinalize(bank, candidate, manifestText, `${JSON.stringify(shorter, null, 2)}\n`)).rejects.toThrow(/storage receipt is incomplete/);
      const padded = { ...receipt, completed: [...shorter.completed, `${manifest.objectPrefix}questions/not-a-real-object.webp`] };
      await expect(replayFinalize(bank, candidate, manifestText, `${JSON.stringify(padded, null, 2)}\n`)).rejects.toThrow(/storage receipt is incomplete/);
    }
    const otherManifest = { ...receipt, assetManifestSha256: manifestSha256({ ...manifest, assets: manifest.assets.slice(1) }) };
    await expect(replayFinalize(bank, candidate, manifestText, `${JSON.stringify(otherManifest, null, 2)}\n`)).rejects.toThrow(/manifest seal mismatch/);
    const unverified = { ...receipt, storageState: "pending_upload" };
    await expect(replayFinalize(bank, candidate, manifestText, `${JSON.stringify(unverified, null, 2)}\n`)).rejects.toThrow(/verified storage receipt/);
  }, 120_000);

  it("re-proves the composed receipt independently and fails closed on any gap", () => {
    expect(verifyReceiptComposition(bank, composition(bank))).toMatchObject({ added: config.added });
    const { manifestText, receiptText, logText } = composition(bank);
    const manifest = JSON.parse(manifestText);
    const receipt = JSON.parse(receiptText);
    const historicalKeys = new Set(JSON.parse(readHistoricalStorage(bank).manifestText).assets.map((asset) => asset.objectKey));
    const newAsset = manifest.assets.find((asset) => !historicalKeys.has(asset.objectKey));
    const oldIndex = manifest.assets.findIndex((asset) => historicalKeys.has(asset.objectKey));
    const unlogged = logText.split("\n").filter((line) => line && !line.includes(`"${newAsset.objectKey}"`)).join("\n") + "\n";
    expect(() => verifyReceiptComposition(bank, composition(bank, { logText: unlogged }))).toThrow(/readback log changed/);
    const changedOld = structuredClone(manifest); changedOld.assets[oldIndex].sha256 = "0".repeat(64);
    expect(() => verifyReceiptComposition(bank, composition(bank, { manifestText: JSON.stringify(changedOld) }))).toThrow(/previously verified object changed/);
    const changedNew = structuredClone(manifest); changedNew.assets.find((asset) => asset.objectKey === newAsset.objectKey).size += 1;
    expect(() => verifyReceiptComposition(bank, composition(bank, { manifestText: JSON.stringify(changedNew) }))).toThrow(/no matching verified readback/);
    const short = { ...receipt, completed: receipt.completed.slice(1) };
    expect(() => verifyReceiptComposition(bank, composition(bank, { receiptText: JSON.stringify(short) }))).toThrow(/completed set is not exactly the manifest/);
    const resealed = { ...receipt, assetManifestSha256: "0".repeat(64) };
    expect(() => verifyReceiptComposition(bank, composition(bank, { receiptText: JSON.stringify(resealed) }))).toThrow(/does not seal this manifest/);
  });
});

describe("0610 May/June 2026 mark-scheme ownership repair (PR #282)", () => {
  const bank = "igcse-biology-0610";

  it("re-cut 24 crops under new keys, created and read back; the first release reconstructs exactly", () => {
    const { rows } = readRepairLog();
    const first = readUploadLog().byKey;
    expect(rows).toHaveLength(24);
    expect(rows.every((row) => row.bank === bank && row.status === "verified" && row.existedBefore === false && row.key.includes("/markschemes/0610-2026-s-")
      && row.key.endsWith(`-${row.sha256.slice(0, 12)}.webp`) && !first.has(row.key))).toBe(true);
    const committed = JSON.parse(read(REPAIR_PLAN_PATH));
    expect(committed).toMatchObject({ mode: "executed-upload-plan", status: "UPLOADED AND VERIFIED", objectCount: 24, upload: { objects: 24, createdNew: 24, overwritten: 0, readbackLog: REPAIR_LOG_PATH } });
    const dryRun = { ...committed, mode: "dry-run-plan-only", status: "NOT UPLOADED" };
    delete dryRun.upload;
    expect(withRepairUploadStatus(dryRun)).toEqual(committed);
    expect(() => withRepairUploadStatus({ ...dryRun, objects: dryRun.objects.slice(1) })).toThrow(/not exactly this plan/);
    const manifest = JSON.parse(read(`data/storage/${bank}.manifest.json`));
    const keys = new Set(manifest.assets.map((asset) => asset.objectKey));
    expect(committed.replaces.every((r) => keys.has(r.key) && !keys.has(r.replacesKey) && first.get(r.replacesKey)?.sha256 === r.replacesSha256)).toBe(true);
    expect(verifyReceiptComposition(bank, composition(bank))).toMatchObject({ previouslyVerified: 13953, added: 780, total: 14733, repairCarried: 14709, repairReplaced: 24 });
  });

  it("fails closed on a changed repair log, an unreviewed replacement, a changed carried object or provenance", () => {
    const base = composition(bank);
    const repairLogText = read(REPAIR_LOG_PATH);
    const repairPlanText = read(REPAIR_PLAN_PATH);
    const shortLog = repairLogText.split("\n").filter(Boolean).slice(1).join("\n") + "\n";
    expect(() => verifyReceiptComposition(bank, { ...base, repairLogText: shortLog, repairPlanText })).toThrow(/repair readback log changed/);
    const plan = JSON.parse(repairPlanText);
    plan.replaces[0].replacesSha256 = "0".repeat(64);
    expect(() => verifyReceiptComposition(bank, { ...base, repairLogText, repairPlanText: JSON.stringify(plan) })).toThrow(/not a reviewed replacement/);
    const manifest = JSON.parse(base.manifestText);
    const historical = new Set(JSON.parse(base.previousManifestText).assets.map((asset) => asset.objectKey));
    const repaired = new Set(JSON.parse(repairPlanText).objects.map((o) => o.key));
    const carried = manifest.assets.find((asset) => !historical.has(asset.objectKey) && !repaired.has(asset.objectKey));
    carried.sha256 = "0".repeat(64);
    expect(() => verifyReceiptComposition(bank, { ...base, manifestText: JSON.stringify(manifest), repairLogText, repairPlanText })).toThrow(/first release object changed/);
    const receipt = JSON.parse(base.receiptText);
    receipt.readbackProvenance[0].droppedUnreferenced = 0;
    expect(() => verifyReceiptComposition(bank, { ...base, receiptText: JSON.stringify(receipt), repairLogText, repairPlanText })).toThrow(/readback provenance/);
  });
});
