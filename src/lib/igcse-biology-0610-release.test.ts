import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import runtime from "@/data/production/igcse-biology-0610.json";
import privateIndex from "@/data/private-index/igcse-biology-0610.json";
import manifest from "../../data/storage/igcse-biology-0610.manifest.json";
import receipt from "../../data/storage/igcse-biology-0610.receipt.json";
import { getCatalogBank } from "@/lib/catalog";
import { getIGCSERuntimeArtifact } from "@/lib/igcse-runtime";
import { getPrivateBankObjectPrefix } from "@/lib/private-runtime-mapping";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const runtimeSeal = () => {
  const copy = JSON.parse(JSON.stringify(runtime));
  copy.runtimeArtifact.runtimeSha256 = null;
  return sha256(JSON.stringify(copy));
};

describe("IGCSE Biology 0610 combined finalized production release", () => {
  it("contains the exact base-plus-extension union after verified finalization", () => {
    expect(runtime.releaseStatus).toBe("production");
    expect(runtime.publicationStatus).toBe("production");
    expect(runtime.assetVerification).toBe("verified_readback");
    expect(runtime.runtimeArtifact.assetVerification).toBe("verified_readback");
    expect(runtime.runtimeArtifact.publicationStatus).toBe("production");
    expect(runtime.questionCount).toBe(4913);
    expect(runtime.paperCount).toBe(298);
    expect(runtime.years).toBe("2019-2026");
    expect(runtime.questions).toHaveLength(4913);
    expect(new Set(runtime.questions.map((q) => q.id)).size).toBe(4913);
    expect(runtime.questions.every((q) => Number.isInteger(q.marks) && q.marks > 0 && q.maxMarks === q.marks)).toBe(true);
    expect(runtime.questions.filter((q) => q.year <= 2020 || q.year === 2026)).toHaveLength(1472);
    expect(runtime.questions.filter((q) => q.year >= 2021 && q.year <= 2025)).toHaveLength(3441);
    expect(runtime.questions.every((q) => q.publicationStatus === "production" && q.classificationReviewStatus === "classified")).toBe(true);
    expect(getIGCSERuntimeArtifact("igcse-biology-0610", { PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" })).toBe(runtime);
  });

  it("has exact referenced-only closure, immutable prefix, and verified receipt", () => {
    expect(manifest.storageState).toBe("pending_upload");
    expect(manifest.assets).toHaveLength(13953);
    expect(new Set(manifest.assets.map((a) => a.objectKey)).size).toBe(13953);
    expect(manifest.objectPrefix).toBe("igcse-biology-0610/releases/combined4913-v1-9e97cd0c0455/");
    expect(manifest.assets.every((a) => a.objectKey.startsWith(manifest.objectPrefix) && a.objectKey.endsWith(".webp"))).toBe(true);
    expect(runtime.questions.flatMap((q) => [...q.questionImages, ...q.markschemeImages])).toHaveLength(13953);
    expect(receipt.storageState).toBe("verified_readback");
    expect(receipt.completed).toHaveLength(13953);
    expect(new Set(receipt.completed).size).toBe(13953);
    expect(receipt.failed).toEqual([]);
    expect(receipt.assetManifestSha256).toBe(runtime.runtimeArtifact.assetManifestSha256);
  });

  it("seals candidate/runtime/index/catalog and preserves the 0610-2019-s-31 QP exception", () => {
    expect(runtime.runtimeArtifact.originalCandidateRuntimeSha256).toBe("9e97cd0c0455ae865b1d14dc462f74ce22d1c66fb734e7d4a8baaf414e0ff961");
    expect(runtime.runtimeArtifact.runtimeSha256).toBe(runtimeSeal());
    expect(runtime.runtimeArtifact.sourceAssemblySha256).toBe("92132de006cb98dcd7f7feef193be05d6cf0233addcaa41b045f6b7771490de1");
    expect(runtime.runtimeArtifact.sourceReconciliationReceiptSha256).toBe("c708d4b0116b3559fd550481a355d0964a722f7027962dfc6297eea1408bcbbd");
    expect(runtime.runtimeArtifact.paperException).toEqual({ paper_id: "0610-2019-s-31", qp_authoritative: true, qp_printed_total: 74, paired_ms_header_max: 80 });
    expect(privateIndex.questions).toHaveLength(4913);
    expect(getPrivateBankObjectPrefix("igcse-biology-0610")).toBe(manifest.objectPrefix);
    expect(getCatalogBank("igcse-biology-0610")).toMatchObject({ questionCount: 4913, paperCount: 298, years: "2019-2026" });
  });
});
