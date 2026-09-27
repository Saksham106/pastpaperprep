import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resealTransportTaxonomy } from "./reseal-0654-transport-taxonomy.mjs";
import { TRANSPORT_MAMMALS_REPARENTING_IDS } from "./generate-coordinated-sciences-0654-runtime.mjs";

const root = path.resolve(import.meta.dirname, "..");
const oldFile = (name) => execFileSync("git", ["show", `d711b6f26af144cc4d3732d99dd63356b418ba27:${name}`], { cwd: root, maxBuffer: 30_000_000 });
const baseline = JSON.parse(oldFile("src/data/production/igcse-coordinated-sciences-0654.json"));
const oldTaxonomy = JSON.parse(oldFile("src/data/igcse-coordinated-sciences-0654-taxonomy.json"));
const taxonomyText = readFileSync(path.join(root, "src/data/igcse-coordinated-sciences-0654-taxonomy.json"), "utf8");
const manifestText = readFileSync(path.join(root, "data/storage/igcse-coordinated-sciences-0654.manifest.json"), "utf8");
const receiptText = readFileSync(path.join(root, "data/storage/igcse-coordinated-sciences-0654.receipt.json"), "utf8");
const inputs = () => ({ baseline: structuredClone(baseline), oldTaxonomy: structuredClone(oldTaxonomy), taxonomyText, manifestText, receiptText });

 describe("0654 source-backed metadata-only reseal", () => {
  it("reparents exactly 39 released rows and preserves the 4,682 others, all assets, and unresolved states", () => {
    const before = inputs();
    const output = resealTransportTaxonomy(before);
    const changed = output.questions.filter((q, i) => JSON.stringify(q) !== JSON.stringify(baseline.questions[i]));
    expect(changed.map((q) => q.id).sort()).toEqual([...TRANSPORT_MAMMALS_REPARENTING_IDS].sort());
    expect(changed).toHaveLength(39);
    expect(output.questions).toHaveLength(4721);
    expect(output.questions.filter((q) => q.classificationReviewStatus === "unresolved_taxonomy_gap")).toHaveLength(4);
    for (const q of changed) {
      expect(q).toMatchObject({ primaryTopic: "Transport in animals", primaryTopicId: "transport-in-animals", subtopics: ["Transport in mammals"], publicationStatus: "production", classificationReviewStatus: "classified" });
      const old = baseline.questions.find((item) => item.id === q.id);
      expect({ ...q, primaryTopic: old.primaryTopic, primaryTopicId: old.primaryTopicId }).toEqual(old);
    }
    expect(output.runtimeArtifact.assetManifestSha256).toBe(baseline.runtimeArtifact.assetManifestSha256);
    expect(output.runtimeArtifact.storageReceiptSha256).toBe(baseline.runtimeArtifact.storageReceiptSha256);
    expect(output.assetVerification).toBe("verified_readback");
    expect(output.runtimeArtifact.taxonomyRepair.changedCount).toBe(39);
    expect(before.baseline).toEqual(baseline);
  });

  it("rejects changed baseline, changed taxonomy, wrong receipt, incomplete objects, or changed asset evidence", () => {
    const mutated = inputs(); mutated.baseline.questions[0].marks = 999;
    expect(() => resealTransportTaxonomy(mutated)).toThrow(/baseline|seal/i);
    const wrongTaxonomy = inputs(); const taxonomy = JSON.parse(taxonomyText); taxonomy.details[0].ownerTopicId = "wrong"; wrongTaxonomy.taxonomyText = JSON.stringify(taxonomy);
    expect(() => resealTransportTaxonomy(wrongTaxonomy)).toThrow(/taxonomy/i);
    const wrongReceipt = inputs(); const receipt = JSON.parse(receiptText); receipt.completed.pop(); wrongReceipt.receiptText = JSON.stringify(receipt);
    expect(() => resealTransportTaxonomy(wrongReceipt)).toThrow(/receipt|complete/i);
    const wrongManifest = inputs(); const manifest = JSON.parse(manifestText); manifest.assets[0].sha256 = "0".repeat(64); wrongManifest.manifestText = JSON.stringify(manifest);
    expect(() => resealTransportTaxonomy(wrongManifest)).toThrow(/manifest/i);
    const wrongReference = inputs(); wrongReference.baseline.questions[0].questionImages[0] = "questions/other.webp";
    expect(() => resealTransportTaxonomy(wrongReference)).toThrow(/baseline|seal|asset/i);
  });
});
