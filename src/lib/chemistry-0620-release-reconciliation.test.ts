import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => JSON.parse(readFileSync(join(process.cwd(), name), "utf8"));

describe("Chemistry 0620 release candidate reconciliation", () => {
  it("keeps the candidate fail-closed pending verified remote readback", () => {
    const receipt = read("data/release/chemistry-0620-reconciliation-receipt.json");
    const storage = read("data/storage/igcse-chemistry-0620.receipt.json");
    expect(receipt.status).toBe("production_candidate_pending_verified_remote_readback");
    expect(receipt.manifestQuestions.served).toBe(5129);
    expect(receipt.manifestQuestions.extensionSegmented).toBe(1808);
    expect(receipt.manifestQuestions.extensionSelected).toBe(1600);
    expect(receipt.honestUnlabeledGapCount).toBe(28);
    expect(receipt.officialBlankPerPartCells.extension).toBe(590);
    expect(receipt.officialBlankPerPartCells.preservedInServedExtension).toBe(589);
    expect(receipt.officialBlankPerPartCells.excludedFromServedRows).toHaveLength(1);
    expect(storage.storageState).toBe("pending_verified_remote_readback");
    expect(storage.completed).toHaveLength(0);
  });
});
