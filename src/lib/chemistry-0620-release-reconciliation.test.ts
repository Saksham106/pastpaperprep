import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => JSON.parse(readFileSync(join(process.cwd(), name), "utf8"));

describe("Chemistry 0620 release candidate reconciliation", () => {
  it("keeps the candidate fail-closed pending verified remote readback", () => {
    const receipt = read("data/release/chemistry-0620-reconciliation-receipt.json");

    expect(receipt.status).toBe("production_candidate_pending_verified_remote_readback");
    expect(receipt.manifestQuestions.served).toBe(5129);
    expect(receipt.manifestQuestions.extensionSegmented).toBe(1808);
    expect(receipt.manifestQuestions.extensionSelected).toBe(1600);
    expect(receipt.honestUnlabeledGapCount).toBe(28);
    expect(receipt.officialBlankPerPartCells.extension).toBe(590);
    expect(receipt.officialBlankPerPartCells.preservedInServedExtension).toBe(589);
    expect(receipt.officialBlankPerPartCells.excludedFromServedRows).toHaveLength(1);
    expect(existsSync(join(process.cwd(), "data/storage/igcse-chemistry-0620.receipt.json"))).toBe(false);
  });

  it("pins the exact collision-safe Chemistry object namespace and manifest size", () => {
    const manifest = read("data/storage/igcse-chemistry-0620.manifest.json");
    expect(manifest.assets).toHaveLength(16819);
    expect(manifest.assets.every((asset: { objectKey: string }) => asset.objectKey.startsWith("igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/"))).toBe(true);
  });

  it("regenerates byte-identical release artifacts from the pinned base", () => {
    const paths = [
      "src/data/production/igcse-chemistry-0620.json",
      "src/data/private-index/igcse-chemistry-0620.json",
      "data/release/chemistry-0620-reconciliation-receipt.json",
    ];
    const committed = paths.map((path) => readFileSync(join(process.cwd(), path)));
    const script = join(process.cwd(), "scripts/build-chemistry-release-candidate.py");
    execFileSync("python3", [script], { cwd: process.cwd(), stdio: "pipe" });
    const firstRun = paths.map((path) => readFileSync(join(process.cwd(), path)));
    execFileSync("python3", [script], { cwd: process.cwd(), stdio: "pipe" });
    const secondRun = paths.map((path) => readFileSync(join(process.cwd(), path)));
    expect(Buffer.compare(firstRun[0], committed[0])).toBe(0);
    expect(firstRun.map((value, index) => Buffer.compare(value, secondRun[index]))).toEqual([0, 0, 0]);
  });
});
