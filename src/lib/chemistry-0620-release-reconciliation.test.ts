import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => JSON.parse(readFileSync(join(process.cwd(), name), "utf8"));

describe("Chemistry 0620 finalized release reconciliation", () => {
	it("records the verified remote readback and preserves the unresolved label gap", () => {
		const receipt = read("data/release/chemistry-0620-reconciliation-receipt.json");

		expect(receipt.status).toBe("production_finalized_verified_readback");
    expect(receipt.manifestQuestions.served).toBe(5129);
    expect(receipt.manifestQuestions.extensionSegmented).toBe(1808);
    expect(receipt.manifestQuestions.extensionSelected).toBe(1600);
    expect(receipt.honestUnlabeledGapCount).toBe(28);
    expect(receipt.officialBlankPerPartCells.extension).toBe(590);
    expect(receipt.officialBlankPerPartCells.preservedInServedExtension).toBe(589);
    expect(receipt.officialBlankPerPartCells.excludedFromServedRows).toHaveLength(1);
    expect(existsSync(join(process.cwd(), "data/storage/igcse-chemistry-0620.receipt.json"))).toBe(true);
    const storageReceipt = read("data/storage/igcse-chemistry-0620.receipt.json");
    expect(storageReceipt.storageState).toBe("verified_readback");
    expect(storageReceipt.completed).toHaveLength(16819);
    expect(new Set(storageReceipt.completed).size).toBe(16819);
    expect(storageReceipt.failed).toEqual([]);
  });

  it("pins the exact collision-safe Chemistry object namespace and manifest size", () => {
    const manifest = read("data/storage/igcse-chemistry-0620.manifest.json");
    expect(manifest.assets).toHaveLength(16819);
    expect(manifest.assets.every((asset: { objectKey: string }) => asset.objectKey.startsWith("igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/"))).toBe(true);
  });

  it("keeps the finalized runtime and private index generated from the pinned base", () => {
    const paths = [
      "src/data/production/igcse-chemistry-0620.json",
      "src/data/private-index/igcse-chemistry-0620.json",
      "data/release/chemistry-0620-reconciliation-receipt.json",
    ];
    const runtime = read("src/data/production/igcse-chemistry-0620.json");
    expect(runtime.releaseStatus).toBe("production");
    expect(runtime.publicationStatus).toBe("production");
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(runtime.runtimeArtifact.publicationStatus).toBe("production");
    expect(runtime.runtimeArtifact.validatedExtensionUnlabeledGapCount).toBe(28);
    expect(readFileSync(join(process.cwd(), paths[1]), "utf8")).toContain('"version": 2');
  });
});
